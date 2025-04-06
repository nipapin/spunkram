import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  downloadExtension: (url, extensionName) => {
    ipcRenderer.send('download-and-install-extension', { url, extensionName })
  },
  onProgressUpdate: (callback) => {
    const subscription = (_event, progress) => callback(progress)
    ipcRenderer.on('download-progress', subscription)
    return () => ipcRenderer.removeListener('download-progress', subscription)
  },
  onInstallationComplete: (callback) => {
    ipcRenderer.once('extension-installed', (_event, result) =>
      callback(result)
    )
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = api
  // @ts-ignore (define in dts)
  window.api = api
}

// Экспортируем API

// Добавим отладочный вывод
console.log('Preload script is running')

// contextBridge.exposeInMainWorld('electronAPI', {
//   sendMessage: (channel, data) => ipcRenderer.send(channel, data),
//   onProgress: (callback) =>
//     ipcRenderer.on('download-progress', (_event, value) => callback(value)),
//   onInstalled: (callback) =>
//     ipcRenderer.once('extension-installed', (_event, value) => callback(value))
// })

// // Максимально простой API с минимальным количеством функций
// contextBridge.exposeInMainWorld('electron', {
//   // Функция для отправки запроса на загрузку
//   downloadExtension: (url, extensionName) => {
//     ipcRenderer.send('download-and-install-extension', { url, extensionName })
//   },

//   // Функция для подписки на обновления прогресса
//   onProgressUpdate: (callback) => {
//     const subscription = (_event, progress) => callback(progress)
//     ipcRenderer.on('download-progress', subscription)
//     return () => ipcRenderer.removeListener('download-progress', subscription)
//   },

//   // Функция для получения результата установки
//   onInstallationComplete: (callback) => {
//     ipcRenderer.once('extension-installed', (_event, result) =>
//       callback(result)
//     )
//   }
// })

// contextBridge.exposeInMainWorld('electron', {
//   ipcRenderer: {
//     send: (channel, data) => {
//       console.log(`Sending message to channel: ${channel}`, data)
//       const validChannels = ['download-and-install-extension']
//       if (validChannels.includes(channel)) {
//         ipcRenderer.send(channel, data)
//       }
//     },
//     on: (channel, callback) => {
//       console.log(`Setting up listener for channel: ${channel}`)
//       const validChannels = ['download-progress', 'extension-installed']
//       if (validChannels.includes(channel)) {
//         // Извлекаем данные из второго аргумента
//         const subscription = (_event, data) => {
//           console.log(`Received data on channel ${channel}:`, data)
//           callback(data)
//         }
//         ipcRenderer.on(channel, subscription)
//         return () => ipcRenderer.removeListener(channel, subscription)
//       }
//       return () => {}
//     },
//     once: (channel, callback) => {
//       console.log(`Setting up one-time listener for channel: ${channel}`)
//       const validChannels = ['extension-installed']
//       if (validChannels.includes(channel)) {
//         // Извлекаем данные из второго аргумента
//         const subscription = (_event, data) => {
//           console.log(`Received data on channel ${channel} (once):`, data)
//           callback(data)
//         }
//         ipcRenderer.once(channel, subscription)
//       }
//     }
//   }
// })

console.log('Preload script completed')
