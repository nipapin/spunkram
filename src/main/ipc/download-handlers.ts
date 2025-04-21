import { ipcMain, dialog } from 'electron'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'
import { exec } from 'sudo-prompt'
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

        // 2. Определяем пути к директориям расширений Adobe CEP
        const systemCepPath = getSystemCEPPath()
        const userCepPath = getUserCEPPath()

        // По умолчанию используем системный путь
        let targetCepPath = systemCepPath
        let extensionDir = path.join(targetCepPath, extensionName)

        console.log(`System CEP path: ${systemCepPath}`)
        console.log(`User CEP path: ${userCepPath}`)
        console.log(`Initial target path: ${targetCepPath}`)

        // 3. Проверяем, есть ли права на запись в системную директорию
        const hasSystemWriteAccess = checkWriteAccess(systemCepPath)

        if (!hasSystemWriteAccess) {
          console.log('No write access to system CEP directory')

          // Показываем диалог пользователю
          const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: [
              'Install with administrator rights',
              'Install to user directory (no rights needed)',
              'Cancel'
            ],
            defaultId: 0,
            title: 'Administrator rights required',
            message:
              'Installing the extension into the system directory requires administrator rights.',
            detail:
              'You can install the extension with administrator rights or in the user directory.'
          })

          if (response === 2) {
            // Отмена
            throw new Error('Installation cancelled by user')
          } else if (response === 1) {
            // Пользовательская директория
            console.log('Using user CEP directory')
            targetCepPath = userCepPath
            extensionDir = path.join(targetCepPath, extensionName)

            // Создаем пользовательскую директорию, если она не существует
            if (!fs.existsSync(targetCepPath)) {
              fs.mkdirSync(targetCepPath, { recursive: true })
            }

            // Удаляем существующую папку расширения, если она есть
            if (fs.existsSync(extensionDir)) {
              fs.rmSync(extensionDir, { recursive: true, force: true })
            }

            // Создаем директорию для расширения
            fs.mkdirSync(extensionDir, { recursive: true })

            // Распаковываем ZXP архив
            try {
              const zip = new AdmZip(zxpPath)
              zip.extractAllTo(extensionDir, true)
            } catch (zipError) {
              console.error('Error extracting zip:', zipError)
              throw new Error(
                `Failed to extract archive: ${zipError instanceof Error ? zipError.message : 'Unknown error'}`
              )
            }

            // Удаляем временный ZXP файл
            fs.unlinkSync(zxpPath)

            event.sender.send('extension-installed', {
              success: true,
              path: extensionDir,
              userDirectory: true
            })
            return
          } else {
            // Установка с правами администратора
            console.log('Installing with elevated privileges')

            // Создаем временную директорию для распаковки
            const extractDir = path.join(tempDir, 'extracted')
            if (fs.existsSync(extractDir)) {
              fs.rmSync(extractDir, { recursive: true, force: true })
            }
            fs.mkdirSync(extractDir, { recursive: true })

            // Распаковываем ZXP во временную директорию
            try {
              const zip = new AdmZip(zxpPath)
              zip.extractAllTo(extractDir, true)
            } catch (zipError) {
              console.error('Error extracting zip:', zipError)
              throw new Error(
                `Failed to extract archive: ${zipError instanceof Error ? zipError.message : 'Unknown error'}`
              )
            }

            // Создаем скрипт для копирования с повышенными правами
            let scriptPath: string
            let scriptContent: string

            if (process.platform === 'win32') {
              // Windows: используем bat-файл с дополнительным логированием
              scriptPath = path.join(tempDir, 'install.bat')
              scriptContent = `
            @echo off
            echo Starting installation script > "%TEMP%\\atomx-install-log.txt"
            echo System CEP path: "${systemCepPath}" >> "%TEMP%\\atomx-install-log.txt"
            echo Extension dir: "${extensionDir}" >> "%TEMP%\\atomx-install-log.txt"
            echo Extract dir: "${extractDir}" >> "%TEMP%\\atomx-install-log.txt"

            if not exist "${systemCepPath}" (
              echo Creating system CEP path >> "%TEMP%\\atomx-install-log.txt"
              mkdir "${systemCepPath}" 2>> "%TEMP%\\atomx-install-log.txt"
            )

            if exist "${extensionDir}" (
              echo Removing existing extension dir >> "%TEMP%\\atomx-install-log.txt"
              rmdir /s /q "${extensionDir}" 2>> "%TEMP%\\atomx-install-log.txt"
            )

            echo Creating extension dir >> "%TEMP%\\atomx-install-log.txt"
            mkdir "${extensionDir}" 2>> "%TEMP%\\atomx-install-log.txt"

            echo Copying files >> "%TEMP%\\atomx-install-log.txt"
            xcopy "${extractDir.replace(/\\/g, '\\\\')}" "${extensionDir.replace(/\\/g, '\\\\')}" /E /I /Y 2>> "%TEMP%\\atomx-install-log.txt"

            echo Installation completed >> "%TEMP%\\atomx-install-log.txt"
            exit
              `.trim()

              // Добавьте дополнительное логирование перед запуском скрипта
            } else {
              // macOS/Linux: используем bash-скрипт
              scriptPath = path.join(tempDir, 'install.sh')
              scriptContent = `
#!/bin/bash
mkdir -p "${systemCepPath}"
rm -rf "${extensionDir}"
mkdir -p "${extensionDir}"
cp -R "${extractDir}/"* "${extensionDir}/"
              `.trim()

              // Делаем скрипт исполняемым
              fs.chmodSync(scriptPath, '755')
            }

            fs.writeFileSync(scriptPath, scriptContent)
            console.log('Script path:', scriptPath)
            console.log('Script content:', scriptContent)

            // Проверьте, что скрипт создан успешно
            if (!fs.existsSync(scriptPath)) {
              throw new Error(`Failed to create script at ${scriptPath}`)
            }
            // Запускаем скрипт с повышенными правами
            try {
              await new Promise<void>((resolve, reject) => {
                console.log('Executing script with elevated privileges...')

                exec(
                  `"${scriptPath}"`, // Заключите путь в кавычки
                  {
                    name: 'AtomX Installer',
                    // Добавьте дополнительные опции для Windows
                    ...(process.platform === 'win32'
                      ? { windowsVerbatimArguments: true }
                      : {})
                  },
                  (error, stdout, stderr) => {
                    if (error) {
                      console.error('Error executing script:', error)
                      console.error('Stdout:', stdout)
                      console.error('Stderr:', stderr)
                      reject(error)
                    } else {
                      console.log('Script executed successfully')
                      console.log('Stdout:', stdout)
                      resolve()
                    }
                  }
                )
              })

              // Удаляем временные файлы
              try {
                fs.unlinkSync(zxpPath)
                fs.unlinkSync(scriptPath)
                fs.rmSync(extractDir, { recursive: true, force: true })
              } catch (e) {
                console.error('Ошибка при удалении временных файлов:', e)
              }

              event.sender.send('extension-installed', {
                success: true,
                path: extensionDir,
                elevated: true
              })
              return
            } catch (sudoError) {
              console.error(
                'Ошибка при выполнении команды с повышенными правами:',
                sudoError
              )
              throw new Error(
                `Failed to install extension: ${sudoError instanceof Error ? sudoError.message : 'Unknown error'}`
              )
            }
          }
        }

        // Если у нас есть права на запись, продолжаем обычную установку
        console.log(`Installing to: ${extensionDir}`)

        // 4. Удаляем существующую папку расширения, если она есть
        if (fs.existsSync(extensionDir)) {
          fs.rmSync(extensionDir, { recursive: true, force: true })
        }

        // 5. Создаем директорию для расширения
        fs.mkdirSync(extensionDir, { recursive: true })

        // 6. Проверяем, что файл существует и имеет ненулевой размер
        if (!fs.existsSync(zxpPath) || fs.statSync(zxpPath).size === 0) {
          throw new Error('Downloaded file is empty or does not exist')
        }

        // 7. Распаковываем ZXP архив с дополнительной проверкой
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

        // 8. Удаляем временный ZXP файл
        fs.unlinkSync(zxpPath)

        console.log('Installation completed successfully')

        // 9. Отправляем сообщение об успешной установке
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
    const extensionName = EXTENSION_NAME
    console.log(`Received request to uninstall: ${extensionName}`)

    try {
      // Определяем пути к директориям расширений Adobe CEP
      const systemCepPath = getSystemCEPPath()
      const userCepPath = getUserCEPPath()

      // Проверяем наличие расширения в обеих директориях
      const systemExtensionDir = path.join(systemCepPath, extensionName)
      const userExtensionDir = path.join(userCepPath, extensionName)
      const versionFile = getVersionFilePath()

      const systemExists = fs.existsSync(systemExtensionDir)
      const userExists = fs.existsSync(userExtensionDir)

      console.log(`System extension exists: ${systemExists}`)
      console.log(`User extension exists: ${userExists}`)

      // Если расширение установлено в системной директории
      if (systemExists) {
        // Проверяем, есть ли права на запись
        const hasSystemWriteAccess = checkWriteAccess(systemCepPath)

        if (!hasSystemWriteAccess) {
          console.log('No write access to system CEP directory')

          // Показываем диалог пользователю
          const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Delete with administrator rights', 'Cancel'],
            defaultId: 0,
            title: 'Access rights required',
            message:
              'Administrator rights are required to remove an extension from the system directory.',
            detail: 'Allow the application to perform this operation?'
          })

          if (response === 1) {
            // Отмена
            throw new Error('Удаление отменено пользователем')
          }

          // Создаем скрипт для удаления с повышенными правами
          const tempDir = path.join(os.tmpdir(), 'adobe-extensions')
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true })
          }

          let scriptPath: string
          let scriptContent: string

          if (process.platform === 'win32') {
            // Windows: используем bat-файл
            scriptPath = path.join(tempDir, 'uninstall.bat')
            scriptContent = `
@echo off
if exist "${systemExtensionDir}" rmdir /s /q "${systemExtensionDir}"
if exist "${versionFile}" del "${versionFile}"
exit
            `.trim()
          } else {
            // macOS/Linux: используем bash-скрипт
            scriptPath = path.join(tempDir, 'uninstall.sh')
            scriptContent = `
#!/bin/bash
rm -rf "${systemExtensionDir}"
rm -f "${versionFile}"
            `.trim()

            // Делаем скрипт исполняемым
            fs.chmodSync(scriptPath, '755')
          }

          fs.writeFileSync(scriptPath, scriptContent)

          // Запускаем скрипт с повышенными правами
          try {
            await new Promise<void>((resolve, reject) => {
              exec(scriptPath, { name: 'AtomX Installer' }, (error) => {
                if (error) {
                  console.error('Ошибка при выполнении команды:', error)
                  reject(error)
                } else {
                  console.log('Удаление завершено успешно')
                  resolve()
                }
              })
            })

            // Удаляем временный скрипт
            try {
              fs.unlinkSync(scriptPath)
            } catch (e) {
              console.error('Ошибка при удалении временного файла:', e)
            }

            event.sender.send('extension-uninstalled', {
              success: true,
              path: systemExtensionDir,
              elevated: true
            })
            return
          } catch (sudoError) {
            console.error(
              'Ошибка при выполнении команды с повышенными правами:',
              sudoError
            )
            throw new Error(
              `Failed to remove extension: ${sudoError instanceof Error ? sudoError.message : 'Unknown error'}`
            )
          }
        }

        // Если у нас есть права на запись, удаляем обычным способом
        fs.rmSync(systemExtensionDir, { recursive: true, force: true })
        console.log(`Removed system extension: ${systemExtensionDir}`)
      }

      // Если расширение установлено в пользовательской директории
      if (userExists) {
        fs.rmSync(userExtensionDir, { recursive: true, force: true })
        console.log(`Removed user extension: ${userExtensionDir}`)
      }

      // Удаляем файл версионизации
      if (fs.existsSync(versionFile)) {
        fs.rmSync(versionFile, { force: true })
        console.log(`Removed version file: ${versionFile}`)
      }

      console.log('Uninstallation completed successfully')

      // Отправляем сообщение об успешном удалении
      const result = {
        success: true,
        systemPath: systemExists ? systemExtensionDir : null,
        userPath: userExists ? userExtensionDir : null
      }
      console.log('Sending uninstallation result:', result)
      event.sender.send('extension-uninstalled', result)
    } catch (error) {
      console.error('Error during uninstallation:', error)
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

function getSystemCEPPath(): string {
  const platform = os.platform()

  if (platform === 'win32') {
    return path.join(
      'C:',
      'Program Files (x86)',
      'Common Files',
      'Adobe',
      'CEP',
      'extensions'
    )
  } else if (platform === 'darwin') {
    return path.join(
      '/',
      'Library',
      'Application Support',
      'Adobe',
      'CEP',
      'extensions'
    )
  } else {
    // Linux или другие платформы (не поддерживаются официально Adobe)
    throw new Error('Unsupported OS')
  }
}

// Функция для проверки прав на запись
function checkWriteAccess(dirPath: string): boolean {
  try {
    // Проверяем, существует ли директория
    if (!fs.existsSync(dirPath)) {
      // Пробуем создать директорию
      try {
        fs.mkdirSync(dirPath, { recursive: true })
        return true
      } catch (e) {
        return false
      }
    }

    // Проверяем права на запись
    fs.accessSync(dirPath, fs.constants.W_OK)
    return true
  } catch (error) {
    return false
  }
}

function getUserCEPPath(): string {
  const platform = os.platform()
  const homeDir = os.homedir()

  if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Adobe', 'CEP', 'extensions')
  } else if (platform === 'darwin') {
    return path.join(
      homeDir,
      'Library',
      'Application Support',
      'Adobe',
      'CEP',
      'extensions'
    )
  } else {
    // Linux или другие платформы (не поддерживаются официально Adobe)
    throw new Error('Unsupported OS')
  }
}

// // Функция для определения пути к директории расширений Adobe CEP
// function getCEPExtensionsPath(): string {
//   const platform = os.platform()
//   const homeDir = os.homedir()

//   if (platform === 'win32') {
//     const systemPath = path.join(
//       'C:',
//       'Program Files (x86)',
//       'Common Files',
//       'Adobe',
//       'CEP',
//       'extensions'
//     )

//     // Проверяем существование системного пути
//     if (fs.existsSync(systemPath)) {
//       try {
//         // Проверяем, есть ли права на запись
//         fs.accessSync(systemPath, fs.constants.W_OK)
//         return systemPath
//       } catch (error) {
//         // Если нет прав на запись в системный путь, используем пользовательский
//         console.log('Нет прав на запись в системный путь CEP')
//       }
//     }

//     // Создаем пользовательский путь, если он не существует
//     if (!fs.existsSync(systemPath)) {
//       fs.mkdirSync(systemPath, { recursive: true })
//     }

//     return systemPath
//   } else if (platform === 'darwin') {
//     // macOS: /Users/{username}/Library/Application Support/Adobe/CEP/extensions
//     const userPath = path.join(
//       homeDir,
//       'Library',
//       'Application Support',
//       'Adobe',
//       'CEP',
//       'extensions'
//     )

//     // Создаем путь, если он не существует
//     if (!fs.existsSync(userPath)) {
//       fs.mkdirSync(userPath, { recursive: true })
//     }

//     return userPath
//   } else {
//     // Linux или другие платформы (не поддерживаются официально Adobe)
//     throw new Error('Unsupported OS')
//   }
// }
