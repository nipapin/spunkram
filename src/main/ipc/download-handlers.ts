import { ipcMain } from 'electron'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'
import { EXTENSION_URL, EXTENSION_NAME } from '@common/constants'
import { getVersionFilePath } from './get-versions'
// Используйте fs вместо rimraf для удаления директорий

export function setupDownloadHandlers() {
  console.log('Setting up download handlers')

  ipcMain.on('download-and-install-extension', (event, version) => {
    // Оборачиваем весь код в асинхронную функцию
    ;(async () => {
      const url = EXTENSION_URL + (version ? `&version=${version}` : '')
      const extensionName = EXTENSION_NAME
      console.log(
        `Received request to download and install URL:${url}, TO FOLDER: ${extensionName}`
      )

      try {
        // Временный путь для скачивания ZXP файла
        const tempDir = path.join(os.tmpdir(), 'adobe-extensions')
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true })
        }

        const zxpPath = path.join(tempDir, `${extensionName}.zxp`)
        console.log(`Will download to: ${zxpPath}`)

        // 1. Скачиваем ZXP файл
        await downloadFile(url, zxpPath, (progress) => {
          // Отправляем только числовое значение
          event.sender.send('download-progress', progress)
        })

        console.log('Download completed, installing...')

        // 2. Определяем путь к директории расширений Adobe CEP
        const cepPath = getCEPExtensionsPath()
        const extensionDir = path.join(cepPath, extensionName)

        console.log(`Will install to: ${extensionDir}`)

        // 3. Удаляем существующую папку расширения, если она есть
        if (fs.existsSync(extensionDir)) {
          fs.rmSync(extensionDir, { recursive: true, force: true })
        }

        // 4. Создаем директорию для расширения
        fs.mkdirSync(extensionDir, { recursive: true })

        // 5. Проверяем, что файл существует и имеет ненулевой размер
        if (!fs.existsSync(zxpPath) || fs.statSync(zxpPath).size === 0) {
          throw new Error('Downloaded file is empty or does not exist')
        }

        // 6. Распаковываем ZXP архив с дополнительной проверкой
        try {
          const zip = new AdmZip(zxpPath)
          zip.extractAllTo(extensionDir, true)
        } catch (zipError) {
          console.error('Error extracting zip:', zipError)
          if (zipError instanceof Error) {
            throw new Error(`Failed to extract archive: ${zipError.message}`)
          } else {
            throw new Error('Failed to extract archive: Unknown error')
          }
        }

        // 7. Удаляем временный ZXP файл
        fs.unlinkSync(zxpPath)

        console.log('Installation completed successfully')

        // 8. Отправляем сообщение об успешной установке
        const result = { success: true, path: extensionDir }
        console.log('Sending installation result:', result)
        event.sender.send('extension-installed', result)
      } catch (error) {
        console.error('Error during installation:', error)
        const errorResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.log('Sending error result:', errorResult)
        event.sender.send('extension-installed', errorResult)
      }
    })().catch((error) => {
      // Дополнительный обработчик для перехвата ошибок в асинхронной функции
      console.error('Unhandled error in download handler:', error)
      event.sender.send('extension-installed', {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    })
  })

  ipcMain.on('uninstall-extension', async (event) => {
    const url = EXTENSION_URL
    const extensionName = EXTENSION_NAME
    console.log(`Received request to uninstall: ${url}, ${extensionName}`)

    try {
      const cepPath = getCEPExtensionsPath()
      const extensionDir = path.join(cepPath, extensionName)

      const getVersionalizeFile = getVersionFilePath()

      // Удаляем расширение (всю папку)
      if (fs.existsSync(extensionDir)) {
        fs.rmSync(extensionDir, { recursive: true, force: true })
      }
      // Удаляем файл версионизации
      if (fs.existsSync(getVersionalizeFile)) {
        fs.rmSync(getVersionalizeFile, { force: true })
      }
      console.log('Uninstallation completed successfully')

      // 7. Отправляем сообщение об успешном удалении
      const result = { success: true, path: extensionDir }
      console.log('Sending uninstallation result:', result)
      event.sender.send('extension-uninstalled', result)
    } catch (error) {
      console.error('Error during installation:', error)
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      console.log('Sending error result:', errorResult)
      event.sender.send('extension-uninstalled', errorResult)
    }
  })
}

// Функция для скачивания файла с отслеживанием прогресса
// Функция для скачивания файла с отслеживанием прогресса
function downloadFile(
  url: string,
  destination: string,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Starting download from ${url}`)
    const file = fs.createWriteStream(destination)

    https
      .get(url, (response) => {
        // Проверяем статус ответа
        if (response.statusCode !== 200) {
          console.error(
            `HTTP Error: ${response.statusCode} ${response.statusMessage}`
          )

          // Удаляем файл, так как он не будет использоваться
          file.close()
          fs.unlink(destination, () => {})

          // Если сервер вернул ошибку, пытаемся прочитать JSON с сообщением об ошибке
          let errorData = ''

          response.on('data', (chunk) => {
            errorData += chunk
          })

          response.on('end', () => {
            try {
              // Пытаемся распарсить JSON с ошибкой
              const errorJson = JSON.parse(errorData)
              reject(
                new Error(
                  errorJson.error || `HTTP Error: ${response.statusCode}`
                )
              )
            } catch (e) {
              // Если не удалось распарсить JSON, возвращаем стандартную ошибку
              reject(
                new Error(
                  `HTTP Error: ${response.statusCode} ${response.statusMessage}`
                )
              )
            }
          })

          return
        }

        const totalLength = parseInt(
          response.headers['content-length'] || '0',
          10
        )
        let downloadedLength = 0

        console.log(`Total file size: ${totalLength} bytes`)

        response.on('data', (chunk) => {
          downloadedLength += chunk.length
          if (totalLength > 0) {
            const progress = Math.round((downloadedLength / totalLength) * 100)
            console.log(`Download progress: ${progress}%`)
            // Отправляем только числовое значение
            onProgress(progress)
          }
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          console.log('Download completed')
          resolve()
        })

        file.on('error', (err) => {
          fs.unlink(destination, () => {})
          console.error('File error:', err)
          reject(err)
        })
      })
      .on('error', (err) => {
        fs.unlink(destination, () => {})
        console.error('HTTPS error:', err)
        reject(err)
      })
  })
}

// // Функция для определения пути к директории расширений Adobe CEP
function getCEPExtensionsPath(): string {
  const platform = os.platform()
  const homeDir = os.homedir()

  if (platform === 'win32') {
    const userPath = path.join(
      process.env.APPDATA || '',
      'Adobe',
      'CEP',
      'extensions'
    )
    const systemPath = path.join(
      'C:',
      'Program Files (x86)',
      'Common Files',
      'Adobe',
      'CEP',
      'extensions'
    )

    // Проверяем существование системного пути
    if (fs.existsSync(systemPath)) {
      try {
        // Проверяем, есть ли права на запись
        fs.accessSync(systemPath, fs.constants.W_OK)
        return systemPath
      } catch (error) {
        // Если нет прав на запись в системный путь, используем пользовательский
        console.log('Нет прав на запись в системный путь CEP')
      }
    }

    // Создаем пользовательский путь, если он не существует
    if (!fs.existsSync(userPath)) {
      fs.mkdirSync(userPath, { recursive: true })
    }

    return systemPath
  } else if (platform === 'darwin') {
    // macOS: /Users/{username}/Library/Application Support/Adobe/CEP/extensions
    const userPath = path.join(
      homeDir,
      'Library',
      'Application Support',
      'Adobe',
      'CEP',
      'extensions'
    )
    const systemPath = path.join(
      '/',
      'Library',
      'Application Support',
      'Adobe',
      'CEP',
      'extensions'
    )

    // Проверяем существование системного пути
    if (fs.existsSync(systemPath)) {
      try {
        // Проверяем, есть ли права на запись
        fs.accessSync(systemPath, fs.constants.W_OK)
        return systemPath
      } catch (error) {
        // Если нет прав на запись в системный путь, используем пользовательский
        console.log('Нет прав на запись в системный путь CEP')
      }
    }

    // Создаем путь, если он не существует
    if (!fs.existsSync(userPath)) {
      fs.mkdirSync(userPath, { recursive: true })
    }

    return userPath
  } else {
    // Linux или другие платформы (не поддерживаются официально Adobe)
    throw new Error('Unsupported OS')
  }
}
