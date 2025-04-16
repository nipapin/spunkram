import { ipcMain, app } from 'electron'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import https from 'https'

import { URL_VERSIONS_LIST, EXTENSION_NAME } from '@common/constants'
import {
  LocalVersion,
  UpdateStatus,
  VersionData
} from '@common/interfaces/IVersions'

/**
 * Helper function to make HTTPS requests
 */
async function httpsGet<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        // Проверяем статус ответа
        if (res.statusCode !== 200) {
          console.error(`HTTP Error: ${res.statusCode} ${res.statusMessage}`)

          // Если сервер вернул ошибку, пытаемся прочитать JSON с сообщением об ошибке
          let errorData = ''

          res.on('data', (chunk) => {
            errorData += chunk
          })

          res.on('end', () => {
            try {
              // Пытаемся распарсить JSON с ошибкой
              const errorJson = JSON.parse(errorData)
              reject(
                new Error(errorJson.error || `HTTP Error: ${res.statusCode}`)
              )
            } catch (e) {
              // Если не удалось распарсить JSON, возвращаем стандартную ошибку
              reject(
                new Error(`HTTP Error: ${res.statusCode} ${res.statusMessage}`)
              )
            }
          })

          return
        }

        let data = ''

        // A chunk of data has been received
        res.on('data', (chunk) => {
          data += chunk
        })

        // The whole response has been received
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(data)
            resolve(parsedData)
          } catch (e) {
            reject(new Error('Failed to parse response data'))
          }
        })
      })
      .on('error', (err) => {
        reject(err)
      })
  })
}

export function getVersionFilePath(): string {
  return join(
    app.getPath('userData'),
    'installed_version_' + EXTENSION_NAME.replaceAll(' ', '_') + '.json'
  )
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
      console.error('Failed to fetch versions:', error)
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
  ipcMain.handle('save-local-version', async (_, version: string) => {
    try {
      const versionFilePath = getVersionFilePath()
      console.log('versionFilePath', versionFilePath)
      const versionData: LocalVersion = {
        version,
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
  })

  // Compare versions and check update status
  ipcMain.handle('check-update-status', async () => {
    try {
      // Get remote versions directly (not using the IPC handler to avoid circular calls)
      const remoteVersions = await httpsGet<VersionData>(URL_VERSIONS_LIST)

      // Get local version
      const versionFilePath = getVersionFilePath()

      let localVersionData: LocalVersion | null = null
      try {
        const data = await readFile(versionFilePath, 'utf-8')
        localVersionData = JSON.parse(data) as LocalVersion
      } catch (err) {
        // If file doesn't exist or is invalid, localVersionData remains null
      }

      if (!localVersionData) {
        return {
          installed: false,
          updateAvailable: false,
          currentVersion: null,
          versions: remoteVersions.list,
          latestVersion: remoteVersions.fixed.stable,
          latestBeta: remoteVersions.fixed.beta
        } as UpdateStatus
      }

      const currentVersion = localVersionData.version
      // const latestStable = remoteVersions.fixed.stable
      // const latestBeta = remoteVersions.fixed.beta

      return {
        installed: true,
        updateAvailable: !remoteVersions.fixed.stable.includes(currentVersion),
        currentVersion,
        versions: remoteVersions.list,
        latestVersion: remoteVersions.fixed.stable,
        latestBeta: remoteVersions.fixed.beta
      } as UpdateStatus
    } catch (error) {
      console.error('Failed to check update status:', error)
      throw new Error('Failed to check update status')
    }
  })
}
