import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
console.log('Preload script is running')
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)

    contextBridge.exposeInMainWorld('api', {
      // Version management
      getRemoteVersions: () => ipcRenderer.invoke('get-remote-versions'),
      getLocalVersion: () => ipcRenderer.invoke('get-local-version'),
      saveLocalVersion: (version: string, groupName: string) =>
        ipcRenderer.invoke('save-local-version', version, groupName),
      checkUpdateStatus: () => ipcRenderer.invoke('check-update-status'),

      // Download / update extension
      downloadExtension: (version: string | null) => {
        ipcRenderer.send('download-and-install-extension', version)
      },
      onProgressUpdate: (callback) => {
        const subscription = (_event, progress) => callback(progress)
        ipcRenderer.on('download-progress', subscription)
        return () =>
          ipcRenderer.removeListener('download-progress', subscription)
      },
      onInstallationComplete: (callback) => {
        ipcRenderer.once('extension-installed', (_event, result) =>
          callback(result)
        )
      },
      uninstallExtension: () => {
        ipcRenderer.send('uninstall-extension')
      },
      onUninstallationComplete: (callback) => {
        ipcRenderer.once('extension-uninstalled', (_event, result) =>
          callback(result)
        )
      }
      // sendMessage: (channel, data) => ipcRenderer.send(channel, data),
      // onProgress: (callback) =>
      //   ipcRenderer.on('download-progress', (_event, value) => callback(value)),
      // onInstalled: (callback) =>
      //   ipcRenderer.once('extension-installed', (_event, value) =>
      //     callback(value)
      //   )
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

console.log('Preload script completed')
