import { ipcMain } from 'electron'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
// Используйте правильный импорт для AdmZip
import AdmZip from 'adm-zip'
// Используйте fs вместо rimraf для удаления директорий

export function setupDownloadHandlers() {
  console.log('Setting up download handlers')

  ipcMain.on(
    'download-and-install-extension',
    async (event, { url, extensionName }) => {
      console.log(
        `Received request to download and install: ${url}, ${extensionName}`
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

        // 5. Распаковываем ZXP архив
        const zip = new AdmZip(zxpPath)
        zip.extractAllTo(extensionDir, true)

        // 6. Удаляем временный ZXP файл
        fs.unlinkSync(zxpPath)

        console.log('Installation completed successfully')

        // 7. Отправляем сообщение об успешной установке
        const result = { success: true, path: extensionDir }
        console.log('Sending installation result:', result)
        event.sender.send('extension-installed', result)
      } catch (error) {
        console.error('Error during installation:', error)
        const errorResult = {
          success: false,
          error: error.message ?? 'Unknown error'
        }
        console.log('Sending error result:', errorResult)
        event.sender.send('extension-installed', errorResult)
      }
    }
  )
}

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
// Функция для определения пути к директории расширений Adobe CEP
function getCEPExtensionsPath(): string {
  const platform = os.platform()
  const homeDir = os.homedir()

  if (platform === 'win32') {
    // const systemPath = path.join(
    //   'C:',
    //   'Program Files (x86)',
    //   'Common Files',
    //   'Adobe',
    //   'CEP',
    //   'extensions'
    // )
    const systemPath = path.join('C:', 'OBS Video', 'sd')
    // 2. Пользовательский путь
    // const userPath = path.join(
    //   homeDir,
    //   'AppData',
    //   'Roaming',
    //   'Adobe',
    //   'CEP',
    //   'extensions'
    // )

    // Проверяем существование системного пути
    // if (fs.existsSync(systemPath)) {
    //   try {
    //     // Проверяем, есть ли права на запись
    //     fs.accessSync(systemPath, fs.constants.W_OK)
    //     return systemPath
    //   } catch (error) {
    //     // Если нет прав на запись в системный путь, используем пользовательский
    //     console.log(
    //       'Нет прав на запись в системный путь CEP, используем пользовательский'
    //     )
    //   }
    // }

    // Создаем пользовательский путь, если он не существует
    if (!fs.existsSync(systemPath)) {
      fs.mkdirSync(systemPath, { recursive: true })
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

    // Создаем путь, если он не существует
    if (!fs.existsSync(userPath)) {
      fs.mkdirSync(userPath, { recursive: true })
    }

    return userPath
  } else {
    // Linux или другие платформы (не поддерживаются официально Adobe)
    throw new Error('Неподдерживаемая операционная система')
  }
}
