import { ipcMain } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { execSync } from 'child_process'
import sudoPrompt from 'sudo-prompt'
import AdmZip from 'adm-zip'
import { EXTENSION_NAME } from '@common/constants'
import {
  CSBridge,
  PluginEntry,
  getMissingCSBridgePlugins,
  getPluginsRoot
} from './cep-paths'

function execAsAdmin(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sudoPrompt.exec(cmd, { name: EXTENSION_NAME }, (err, stdout) => {
      if (err) reject(err)
      else resolve(typeof stdout === 'string' ? stdout : '')
    })
  })
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
      const dir = pathDir(dest)
      return `(if not exist "${dir}" mkdir "${dir}") && copy /Y "${src}" "${dest}"`
    })
    .join(' && ')

  await execAsAdmin(cmd)
}

async function copyPairsAsAdminMac(pairs: [string, string][]): Promise<void> {
  const cmd = pairs
    .map(
      ([src, dest]) =>
        `mkdir -p "${pathDir(dest)}" && cp -Rf "${src}" "${dest}"`
    )
    .join(' && ')
  await execAsAdmin(cmd)
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

function pathDir(p: string): string {
  return p.substring(0, Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')))
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
  // Бандлы хранятся в zip ровно как в CEP-варианте, распаковываем рядом.
  const zipPath = join(pluginsRoot, 'cep-helpers.zip')
  if (fs.existsSync(zipPath)) {
    new AdmZip(zipPath).extractAllTo(pluginsRoot, true)
  }

  const pairs: [string, string][] = missing.map((p) => {
    const bundle = join(pluginsRoot, p.file)
    const macosDir = join(bundle, 'Contents', 'MacOS')
    if (fs.existsSync(macosDir)) {
      execSync(`chmod -R +x "${macosDir}"`)
    }
    return [bundle, join(p.folder, p.file)]
  })
  await copyPairsAsAdminMac(pairs)

  const stillMissing = verifyDestinationsExist(pairs)
  if (stillMissing.length > 0) {
    throw new Error(
      `Copy reported success but files are not on disk: ${stillMissing.join(', ')}`
    )
  }
  return pairs.map(([, dest]) => dest)
}

export function registerInstallPluginsHandlers(): void {
  ipcMain.handle('check-plugins', () => {
    const missing = getMissingCSBridgePlugins()
    return missing
  })

  ipcMain.handle('install-plugins', async () => {
    try {
      const platform: 'win' | 'mac' =
        process.platform === 'win32' ? 'win' : 'mac'
      const config = CSBridge[platform]
      const pluginsRoot = getPluginsRoot()

      const missing = config.filter(
        (p) => !fs.existsSync(join(p.folder, p.file))
      )
      if (missing.length === 0) {
        return { success: true, installed: [], alreadyPresent: true }
      }

      // Заранее проверим, есть ли исходники в pluginsRoot — иначе sudo упадёт без понятного объяснения.
      const missingSources = missing.filter(
        (p) => !fs.existsSync(join(pluginsRoot, p.file))
      )
      if (platform === 'win' && missingSources.length > 0) {
        const list = missingSources.map((p) => p.file).join(', ')
        return {
          success: false,
          error: `Plugin source files not found in installer: ${list}`
        }
      }

      const installed =
        platform === 'win'
          ? await installWin(missing, pluginsRoot)
          : await installMac(missing, pluginsRoot)

      return { success: true, installed, alreadyPresent: false }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })
}
