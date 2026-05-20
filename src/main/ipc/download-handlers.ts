import { ipcMain, type WebContents } from 'electron'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { URL } from 'url'
import sudoPrompt from 'sudo-prompt'
import AdmZip from 'adm-zip'
import { EXTENSION_URL, EXTENSION_NAME } from '@common/constants'
import { getVersionFilePath } from './get-versions'
import {
  chooseCEPInstallTarget,
  findInstalledCEPExtensionPath,
  isPathWritableByCurrentUser
} from './cep-paths'

// 60 секунд на скачивание ZXP — обычно меньше мегабайта, но даём запас.
const DOWNLOAD_TIMEOUT_MS = 60_000
const MAX_REDIRECTS = 5

// sudo-prompt принимает в `name` только [A-Za-z0-9 ].
const SUDO_PROMPT_NAME = EXTENSION_NAME.replace(/[^A-Za-z0-9 ]/g, '')

function execAsAdmin(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sudoPrompt.exec(cmd, { name: SUDO_PROMPT_NAME }, (err, stdout) => {
      if (err) reject(err)
      else resolve(typeof stdout === 'string' ? stdout : '')
    })
  })
}

function safeSend(wc: WebContents, channel: string, payload: unknown): void {
  if (!wc.isDestroyed()) wc.send(channel, payload)
}

/** POSIX shell: оборачиваем в одинарные кавычки и экранируем ' внутри. */
function shQuote(p: string): string {
  return `'${p.replace(/'/g, `'\\''`)}'`
}

/** cmd.exe внутри двойных кавычек: " % ^ ! & надо экранировать через ^. */
function cmdQuote(p: string): string {
  const escaped = p
    .replace(/\^/g, '^^')
    .replace(/"/g, '^"')
    .replace(/%/g, '^%')
    .replace(/!/g, '^!')
    .replace(/&/g, '^&')
  return `"${escaped}"`
}

function tryRm(target: string, recursive: boolean): void {
  try {
    fs.rmSync(target, { recursive, force: true })
  } catch (err) {
    console.warn('[download-handlers] failed to remove', target, err)
  }
}

export function setupDownloadHandlers(): void {
  ipcMain.on('download-and-install-extension', (event, version) => {
    void runInstall(event.sender, version)
  })

  ipcMain.on('uninstall-extension', (event) => {
    void runUninstall(event.sender)
  })
}

// -----------------------------------------------------------------------------
// Install flow
// -----------------------------------------------------------------------------

async function runInstall(
  wc: WebContents,
  version: string | null | undefined
): Promise<void> {
  const url = EXTENSION_URL + (version ? `&version=${version}` : '')

  let zxpPath: string | null = null
  let stagingDir: string | null = null

  try {
    const target = chooseCEPInstallTarget(EXTENSION_NAME)

    // 1. Готовим рабочие пути во временной директории — никаких записей
    //    в .app/Program Files до того, как у нас есть валидный архив на диске.
    const workRoot = path.join(os.tmpdir(), 'spunkram-installer')
    fs.mkdirSync(workRoot, { recursive: true })
    zxpPath = path.join(workRoot, `${EXTENSION_NAME}-${Date.now()}.zxp`)

    // 2. Скачиваем ZXP с прогрессом, редиректами и таймаутом.
    await downloadFile(url, zxpPath, (progress) =>
      safeSend(wc, 'download-progress', progress)
    )

    if (!fs.existsSync(zxpPath) || fs.statSync(zxpPath).size === 0) {
      throw new Error('Downloaded file is empty or does not exist')
    }

    // 3. Распаковываем во временный staging-каталог. Если что-то пойдёт
    //    не так на этапе подмены — текущая установка остаётся целой.
    stagingDir = path.join(workRoot, `staging-${Date.now()}`)
    fs.mkdirSync(stagingDir, { recursive: true })
    try {
      new AdmZip(zxpPath).extractAllTo(stagingDir, true)
    } catch (zipErr) {
      throw new Error(
        `Failed to extract archive: ${
          zipErr instanceof Error ? zipErr.message : 'Unknown error'
        }`
      )
    }

    // 4. Подменяем старую установку на новую. Под админом — только
    //    если выбран system-path, иначе всё через обычный fs.
    await installFromStaging(stagingDir, target)

    safeSend(wc, 'extension-installed', { success: true, path: target.path })
  } catch (error) {
    console.error('[install-extension] failed:', error)
    safeSend(wc, 'extension-installed', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  } finally {
    if (zxpPath) tryRm(zxpPath, false)
    if (stagingDir) tryRm(stagingDir, true)
  }
}

async function installFromStaging(
  stagingDir: string,
  target: { path: string; isSystemWide: boolean; needsAdmin: boolean }
): Promise<void> {
  if (target.needsAdmin) {
    await replaceDirAsAdmin(stagingDir, target.path)
    return
  }

  // user-path: всё делаем напрямую, без UAC.
  fs.mkdirSync(path.dirname(target.path), { recursive: true })

  if (fs.existsSync(target.path)) {
    try {
      fs.rmSync(target.path, { recursive: true, force: true })
    } catch (rmErr) {
      throw new Error(
        `Cannot replace existing extension folder at ${target.path}. ` +
          `Premiere Pro or After Effects may be holding files open. ` +
          `Please close all Adobe apps and try again.\n` +
          `Original error: ${
            rmErr instanceof Error ? rmErr.message : String(rmErr)
          }`
      )
    }
  }

  // fs.cpSync доступен в Node 16.7+ (electron 28 идёт с Node 18+).
  fs.cpSync(stagingDir, target.path, { recursive: true, force: true })
}

async function replaceDirAsAdmin(
  stagingDir: string,
  destPath: string
): Promise<void> {
  const parent = path.dirname(destPath)
  if (process.platform === 'win32') {
    const cmd = [
      `(if not exist ${cmdQuote(parent)} mkdir ${cmdQuote(parent)})`,
      `(if exist ${cmdQuote(destPath)} rmdir /S /Q ${cmdQuote(destPath)})`,
      // xcopy создаёт целевую папку (/I) и копирует поддиректории (/E).
      `xcopy /E /I /Y ${cmdQuote(stagingDir)} ${cmdQuote(destPath)}`
    ].join(' && ')
    await execAsAdmin(cmd)
  } else {
    const cmd = [
      `mkdir -p ${shQuote(parent)}`,
      `rm -rf ${shQuote(destPath)}`,
      `cp -Rf ${shQuote(stagingDir)} ${shQuote(destPath)}`
    ].join(' && ')
    await execAsAdmin(cmd)
  }

  if (!fs.existsSync(destPath)) {
    throw new Error(
      `Elevated copy reported success but ${destPath} is missing on disk`
    )
  }
}

// -----------------------------------------------------------------------------
// Uninstall flow
// -----------------------------------------------------------------------------

async function runUninstall(wc: WebContents): Promise<void> {
  try {
    const extPath = findInstalledCEPExtensionPath(EXTENSION_NAME)

    if (extPath) {
      if (isPathWritableByCurrentUser(extPath)) {
        try {
          fs.rmSync(extPath, { recursive: true, force: true })
        } catch (rmErr) {
          throw new Error(
            `Cannot remove ${extPath}. ` +
              `Premiere Pro or After Effects may be holding files open. ` +
              `Please close all Adobe apps and try again.\n` +
              `Original error: ${
                rmErr instanceof Error ? rmErr.message : String(rmErr)
              }`
          )
        }
      } else {
        // system-path под обычным юзером — поднимаем UAC только на rm.
        const cmd =
          process.platform === 'win32'
            ? `rmdir /S /Q ${cmdQuote(extPath)}`
            : `rm -rf ${shQuote(extPath)}`
        await execAsAdmin(cmd)
      }
    }

    const versionFile = getVersionFilePath()
    if (fs.existsSync(versionFile)) {
      fs.rmSync(versionFile, { force: true })
    }

    safeSend(wc, 'extension-uninstalled', {
      success: true,
      path: extPath ?? undefined
    })
  } catch (error) {
    console.error('[uninstall-extension] failed:', error)
    safeSend(wc, 'extension-uninstalled', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// -----------------------------------------------------------------------------
// HTTP download helper
// -----------------------------------------------------------------------------

/**
 * Качает `url` в `destination`, дёргает `onProgress(percent)`.
 *
 *  - Поддерживает 30x-редиректы (только в пределах https).
 *  - Соблюдает таймаут на каждом hop'е.
 *  - Проверяет соответствие реально скачанной длины и Content-Length —
 *    обрыв TCP в середине больше не будет интерпретироваться как success.
 */
function downloadFile(
  url: string,
  destination: string,
  onProgress: (progress: number) => void,
  redirectsLeft: number = MAX_REDIRECTS
): Promise<void> {
  return new Promise((resolve, reject) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch (parseErr) {
      reject(parseErr)
      return
    }

    if (parsed.protocol !== 'https:') {
      reject(
        new Error(
          `Refusing to download from non-https URL: ${parsed.protocol}//...`
        )
      )
      return
    }

    const req = https.get(url, (response) => {
      const status = response.statusCode || 0

      // --- Редиректы --------------------------------------------------------
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume()
        if (redirectsLeft <= 0) {
          reject(new Error(`Too many redirects while fetching ${url}`))
          return
        }
        let nextUrl: string
        try {
          nextUrl = new URL(response.headers.location, url).toString()
        } catch (urlErr) {
          reject(urlErr)
          return
        }
        downloadFile(nextUrl, destination, onProgress, redirectsLeft - 1).then(
          resolve,
          reject
        )
        return
      }

      // --- Не-200: попробуем достать JSON-ошибку из тела -------------------
      if (status !== 200) {
        let errorData = ''
        response.on('data', (chunk) => (errorData += chunk))
        response.on('end', () => {
          try {
            const j = JSON.parse(errorData)
            reject(new Error(j.error || `HTTP Error: ${status}`))
          } catch {
            reject(
              new Error(
                `HTTP Error: ${status} ${response.statusMessage ?? ''}`.trim()
              )
            )
          }
        })
        return
      }

      // --- Запись на диск + проверка длины ---------------------------------
      // Открываем файл только сейчас, когда уже точно знаем, что данные пойдут.
      const file = fs.createWriteStream(destination)
      const totalLength = parseInt(
        response.headers['content-length'] || '0',
        10
      )
      let downloadedLength = 0

      response.on('data', (chunk) => {
        downloadedLength += chunk.length
        if (totalLength > 0) {
          onProgress(Math.round((downloadedLength / totalLength) * 100))
        }
      })

      response.pipe(file)

      file.on('finish', () => {
        file.close((closeErr) => {
          if (closeErr) {
            tryRm(destination, false)
            reject(closeErr)
            return
          }
          if (totalLength > 0 && downloadedLength !== totalLength) {
            tryRm(destination, false)
            reject(
              new Error(
                `Download truncated: ${downloadedLength}/${totalLength} bytes`
              )
            )
            return
          }
          resolve()
        })
      })

      file.on('error', (err) => {
        tryRm(destination, false)
        reject(err)
      })

      response.on('error', (err) => {
        tryRm(destination, false)
        reject(err)
      })
    })

    req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
      req.destroy(new Error(`Download timeout after ${DOWNLOAD_TIMEOUT_MS}ms`))
    })

    req.on('error', (err) => {
      tryRm(destination, false)
      reject(err)
    })
  })
}
