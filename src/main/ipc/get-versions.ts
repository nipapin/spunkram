import { ipcMain, app } from 'electron'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import https from 'https'
import { URL } from 'url'

import { URL_VERSIONS_LIST, EXTENSION_NAME } from '@common/constants'
import {
  LocalVersion,
  UpdateStatus,
  VersionData
} from '@common/interfaces/IVersions'
import {
  findInstalledCEPExtensionPath,
  getMissingCSBridgePlugins
} from './cep-paths'

const HTTPS_TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 5

/**
 * Helper function to make HTTPS GET request that:
 *  - поддерживает редиректы (только в пределах https);
 *  - имеет timeout — без него зависшая TCP-сессия повесит UI на спиннер;
 *  - возвращает распарсенный JSON-ответ.
 */
async function httpsGet<T>(
  url: string,
  redirectsLeft: number = MAX_REDIRECTS
): Promise<T> {
  return new Promise((resolve, reject) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch (parseErr) {
      reject(parseErr)
      return
    }
    if (parsed.protocol !== 'https:') {
      reject(new Error(`Refusing non-https request: ${parsed.protocol}//...`))
      return
    }

    const req = https.get(url, (res) => {
      const status = res.statusCode || 0

      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        if (redirectsLeft <= 0) {
          reject(new Error(`Too many redirects while fetching ${url}`))
          return
        }
        let next: string
        try {
          next = new URL(res.headers.location, url).toString()
        } catch (urlErr) {
          reject(urlErr)
          return
        }
        httpsGet<T>(next, redirectsLeft - 1).then(resolve, reject)
        return
      }

      if (status !== 200) {
        let errorData = ''
        res.on('data', (chunk) => (errorData += chunk))
        res.on('end', () => {
          try {
            const j = JSON.parse(errorData)
            reject(new Error(j.error || `HTTP Error: ${status}`))
          } catch {
            reject(
              new Error(
                `HTTP Error: ${status} ${res.statusMessage ?? ''}`.trim()
              )
            )
          }
        })
        return
      }

      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as T)
        } catch {
          reject(new Error('Failed to parse response data'))
        }
      })
      res.on('error', reject)
    })

    req.setTimeout(HTTPS_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timeout after ${HTTPS_TIMEOUT_MS}ms`))
    })

    req.on('error', reject)
  })
}

export function getVersionFilePath(): string {
  return join(
    app.getPath('userData'),
    'installed_version_' + EXTENSION_NAME.replaceAll(' ', '_') + '.json'
  )
}

/** Последняя stable-версия с сервера (fixed.stable). */
export async function getLatestStableVersion(): Promise<string> {
  const data = await httpsGet<VersionData>(URL_VERSIONS_LIST)
  const stable = data.fixed?.stable?.trim()
  if (!stable) {
    throw new Error('Stable version is missing in versions_list response')
  }
  return stable
}

/**
 * Register all version-related IPC handlers
 */
export function registerVersionHandlers() {
  // Get versions from API
  ipcMain.handle('get-remote-versions', async () => {
    try {
      // Replace with your actual API endpoint
      const data = await httpsGet<VersionData>(URL_VERSIONS_LIST)
      return data
    } catch (error) {
      throw new Error('Failed to fetch version data from server')
    }
  })

  // Get local version from file
  ipcMain.handle('get-local-version', async () => {
    try {
      const versionFilePath = getVersionFilePath()

      try {
        const data = await readFile(versionFilePath, 'utf-8')
        return JSON.parse(data) as LocalVersion
      } catch (err) {
        // If file doesn't exist or is invalid, return null
        return null
      }
    } catch (error) {
      console.error('Failed to read local version:', error)
      throw new Error('Failed to read local version data')
    }
  })

  // Save local version to file
  ipcMain.handle(
    'save-local-version',
    async (_, version: string, groupName: string) => {
      try {
        const versionFilePath = getVersionFilePath()
        const versionData: LocalVersion = {
          version,
          group: groupName,
          installedAt: new Date().toISOString()
        }

        await writeFile(
          versionFilePath,
          JSON.stringify(versionData, null, 2),
          'utf-8'
        )
        return true
      } catch (error) {
        console.error('Failed to save local version:', error)
        throw new Error('Failed to save local version data')
      }
    }
  )

  // Compare versions and check update status
  ipcMain.handle('check-update-status', async () => {
    try {
      // Get remote versions directly (not using the IPC handler to avoid circular calls)
      const remoteVersions = await httpsGet<VersionData>(URL_VERSIONS_LIST)

      // 1. JSON-маркер версии (то, что мы сами писали при установке)
      const versionFilePath = getVersionFilePath()
      let localVersionData: LocalVersion | null = null
      try {
        const data = await readFile(versionFilePath, 'utf-8')
        localVersionData = JSON.parse(data) as LocalVersion
      } catch {
        // нет файла или невалидный JSON
      }

      // 2. Реальное состояние диска
      const extensionPath = findInstalledCEPExtensionPath(EXTENSION_NAME)
      const pluginsMissing = getMissingCSBridgePlugins()

      const diskState: UpdateStatus['diskState'] = {
        versionFileExists: localVersionData !== null,
        extensionPath,
        pluginsMissing
      }

      // "Установлено" только если оба источника подтверждают:
      //   - наш маркер версии есть
      //   - папка CEP-расширения реально существует на диске
      // Если юзер удалил папку вручную, JSON-маркер игнорируем —
      // плашка "v3.3.3 · Installed" больше врать не будет.
      const reallyInstalled =
        localVersionData !== null && extensionPath !== null

      if (!reallyInstalled) {
        return {
          installed: false,
          updateAvailable: false,
          currentVersion: null,
          currentGroup: null,
          versions: remoteVersions.list,
          latestVersion: remoteVersions.fixed.stable,
          latestBeta: remoteVersions.fixed.beta,
          diskState
        } as UpdateStatus
      }

      const currentVersion = localVersionData!.version
      const currentGroup = localVersionData!.group ?? null

      return {
        installed: true,
        updateAvailable: !remoteVersions.fixed.stable.includes(currentVersion),
        currentVersion,
        currentGroup,
        versions: remoteVersions.list,
        latestVersion: remoteVersions.fixed.stable,
        latestBeta: remoteVersions.fixed.beta,
        diskState
      } as UpdateStatus
    } catch (error) {
      console.error('Failed to check update status:', error)
      throw new Error('Failed to check update status')
    }
  })
}
