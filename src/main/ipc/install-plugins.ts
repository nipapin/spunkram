import { ipcMain, app } from 'electron'
import { dirname, join, resolve } from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { execSync } from 'child_process'
import sudoPrompt from 'sudo-prompt'
import AdmZip from 'adm-zip'
import { EXTENSION_NAME } from '@common/constants'
import {
  CSBridge,
  PluginEntry,
  getMissingCSBridgePlugins,
  getPluginsRoot,
  resolveCSBridgePluginDestDir
} from './cep-paths'

// sudo-prompt разрешает в `name` только [A-Za-z0-9 ], без спецсимволов.
// EXTENSION_NAME сейчас 'Spunkram' — проходит, но защитимся на будущее.
const SUDO_PROMPT_NAME = EXTENSION_NAME.replace(/[^A-Za-z0-9 ]/g, '')

function execAsAdmin(cmd: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    sudoPrompt.exec(cmd, { name: SUDO_PROMPT_NAME }, (err, stdout) => {
      if (err) reject(err)
      else resolvePromise(typeof stdout === 'string' ? stdout : '')
    })
  })
}

/**
 * Экранирование одинарных кавычек для POSIX shell.
 *   'abc' → 'abc'
 *   it's → 'it'\''s'
 */
function shQuote(p: string): string {
  return `'${p.replace(/'/g, `'\\''`)}'`
}

/**
 * Экранирование для cmd.exe внутри двойных кавычек.
 * Внутри "..." опасны: " % ^ ! &
 *   " — экранируется удвоением;
 *   % и ! — раскрываются как переменные → удваиваем ^;
 *   ^ & — управляющие;
 * Для простоты бьём через ^.
 */
function cmdQuote(p: string): string {
  const escaped = p
    .replace(/\^/g, '^^')
    .replace(/"/g, '^"')
    .replace(/%/g, '^%')
    .replace(/!/g, '^!')
    .replace(/&/g, '^&')
  return `"${escaped}"`
}

async function copyPairsAsAdminWin(pairs: [string, string][]): Promise<void> {
  // Создаём целевые папки и копируем файлы одной поднятой командой.
  //
  // ВАЖНО: cmd.exe считает `&&` после `if` частью тела `if`, то есть
  //   `if not exist "DIR" mkdir "DIR" && copy ...`
  // парсится как
  //   `if not exist "DIR" (mkdir "DIR" && copy ...)`
  // → если папка уже существует, copy НЕ выполнится и при этом не будет
  //   никакой ошибки. Поэтому оборачиваем if-блок в скобки, чтобы `&&`
  //   относился ко всей конструкции.
  const cmd = pairs
    .map(([src, dest]) => {
      const dir = cmdQuote(dirname(dest))
      const srcQ = cmdQuote(src)
      const destQ = cmdQuote(dest)
      return `(if not exist ${dir} mkdir ${dir}) && copy /Y ${srcQ} ${destQ}`
    })
    .join(' && ')

  await execAsAdmin(cmd)
}

async function copyPairsAsAdminMac(pairs: [string, string][]): Promise<void> {
  const cmd = pairs
    .map(([src, dest]) => {
      const dir = shQuote(dirname(dest))
      return `mkdir -p ${dir} && cp -Rf ${shQuote(src)} ${shQuote(dest)}`
    })
    .join(' && ')
  await execAsAdmin(cmd)
}

function isDestUnderHomeDir(dest: string): boolean {
  const destAbs = resolve(dest)
  const homeAbs = resolve(os.homedir())
  return destAbs === homeAbs || destAbs.startsWith(`${homeAbs}/`)
}

function chmodMacOSBinaryDir(bundlePath: string): void {
  const macosDir = join(bundlePath, 'Contents', 'MacOS')
  if (fs.existsSync(macosDir)) {
    execSync(`chmod -R +x "${macosDir}"`)
  }
}

/**
 * Копия в ~/Library/... без sudo: иначе бандл становится root-owned и
 * последующая распаковка ZXP в папку расширения падает с EACCES на rmdir.
 */
function copyMacBundleAsCurrentUser(src: string, dest: string): void {
  const parent = dirname(dest)
  fs.mkdirSync(parent, { recursive: true })
  if (fs.existsSync(dest)) {
    try {
      fs.rmSync(dest, { recursive: true, force: true })
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'EACCES') {
        throw new Error(
          `Cannot replace "${dest}" (permission denied). If a previous install copied it as root, run: sudo rm -rf "${dest}" and try again.`
        )
      }
      throw err
    }
  }
  fs.cpSync(src, dest, { recursive: true })
  chmodMacOSBinaryDir(dest)
}

async function copyPairsOnMac(pairs: [string, string][]): Promise<void> {
  const sudoPairs: [string, string][] = []
  for (const [src, dest] of pairs) {
    if (isDestUnderHomeDir(dest)) {
      copyMacBundleAsCurrentUser(src, dest)
    } else {
      sudoPairs.push([src, dest])
    }
  }
  if (sudoPairs.length > 0) {
    await copyPairsAsAdminMac(sudoPairs)
  }
}

/**
 * После того как sudo-prompt вернул success, перепроверяем что файлы
 * действительно лежат на месте. Без этого баг "копия молча не выполнилась"
 * совершенно невидим: exit-код 0, ошибки нет, файла тоже нет.
 */
function verifyDestinationsExist(pairs: [string, string][]): string[] {
  return pairs
    .filter(([, dest]) => !fs.existsSync(dest))
    .map(([, dest]) => dest)
}

/**
 * Возвращает каталог для распаковки бандлов плагинов на Mac.
 * НЕ распаковываем внутрь .app — это ломает code-signature и часто
 * запрещено правами (если .app установлен в /Applications админом).
 *
 * Используем подкаталог в системном temp, привязанный к версии приложения,
 * чтобы между апдейтами не подсовывался старый кеш.
 */
function getMacExtractDir(): string {
  return join(os.tmpdir(), `${SUDO_PROMPT_NAME}-plugins-${app.getVersion()}`)
}

async function installWin(
  missing: PluginEntry[],
  pluginsRoot: string
): Promise<string[]> {
  const pairs: [string, string][] = missing.map((p) => [
    join(pluginsRoot, p.file),
    join(p.folder, p.file)
  ])
  await copyPairsAsAdminWin(pairs)

  const stillMissing = verifyDestinationsExist(pairs)
  if (stillMissing.length > 0) {
    console.error(
      '[install-plugins][win] copy succeeded but files missing:',
      stillMissing
    )
    throw new Error(
      `Copy reported success but files are not on disk: ${stillMissing.join(', ')}`
    )
  }
  return pairs.map(([, dest]) => dest)
}

async function installMac(
  missing: PluginEntry[],
  pluginsRoot: string
): Promise<string[]> {
  const zipPath = join(pluginsRoot, 'cep-helpers.zip')
  if (!fs.existsSync(zipPath)) {
    throw new Error(
      `Plugin source archive not found in installer: ${zipPath}. ` +
        `Make sure resources/plugins/mac/cep-helpers.zip is packaged via extraResources.`
    )
  }

  const extractDir = getMacExtractDir()
  fs.mkdirSync(extractDir, { recursive: true })
  new AdmZip(zipPath).extractAllTo(extractDir, true)

  const missingSources = missing.filter(
    (p) => !fs.existsSync(join(extractDir, p.file))
  )
  if (missingSources.length > 0) {
    const list = missingSources.map((p) => p.file).join(', ')
    throw new Error(`Plugin bundles missing inside cep-helpers.zip: ${list}`)
  }

  const pairs: [string, string][] = missing.map((p) => {
    const bundle = join(extractDir, p.file)
    const macosDir = join(bundle, 'Contents', 'MacOS')
    if (fs.existsSync(macosDir)) {
      try {
        execSync(`chmod -R +x ${shQuote(macosDir)}`)
      } catch (chmodErr) {
        console.warn('[install-plugins][mac] chmod failed:', chmodErr)
      }
    }
    const destDir = resolveCSBridgePluginDestDir(p, 'darwin')
    if (!destDir) {
      throw new Error(
        'CEP extension is not installed; cannot place Motionflow.bundle under extension bin/mac. Install the extension first.'
      )
    }
    return [bundle, join(destDir, p.file)]
  })

  await copyPairsOnMac(pairs)

  const stillMissing = verifyDestinationsExist(pairs)
  if (stillMissing.length > 0) {
    console.error(
      '[install-plugins][mac] copy succeeded but files missing:',
      stillMissing
    )
    throw new Error(
      `Copy reported success but files are not on disk: ${stillMissing.join(', ')}`
    )
  }
  return pairs.map(([, dest]) => dest)
}

export function registerInstallPluginsHandlers(): void {
  ipcMain.handle('check-plugins', () => {
    return getMissingCSBridgePlugins()
  })

  ipcMain.handle('install-plugins', async () => {
    try {
      const platform: 'win' | 'mac' =
        process.platform === 'win32' ? 'win' : 'mac'
      const config = CSBridge[platform]
      const pluginsRoot = getPluginsRoot()

      const missing = config.filter((p) => {
        const dir = resolveCSBridgePluginDestDir(p, process.platform)
        if (!dir) return true
        return !fs.existsSync(join(dir, p.file))
      })
      if (missing.length === 0) {
        return { success: true, installed: [], alreadyPresent: true }
      }

      if (platform === 'win') {
        const missingSources = missing.filter(
          (p) => !fs.existsSync(join(pluginsRoot, p.file))
        )
        if (missingSources.length > 0) {
          const list = missingSources.map((p) => p.file).join(', ')
          return {
            success: false,
            error:
              `Plugin source files not found in installer: ${list}. ` +
              `Check electron-builder.yml → extraResources.`
          }
        }
      }

      const installed =
        platform === 'win'
          ? await installWin(missing, pluginsRoot)
          : await installMac(missing, pluginsRoot)

      return { success: true, installed, alreadyPresent: false }
    } catch (error) {
      console.error('[install-plugins] failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })
}
