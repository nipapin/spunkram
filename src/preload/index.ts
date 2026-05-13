import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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
      },
      fetchLinks: () => ipcRenderer.invoke('fetch-links'),

      // Native plugin bundles (CSBridge etc.)
      checkPlugins: () => ipcRenderer.invoke('check-plugins'),
      installPlugins: () => ipcRenderer.invoke('install-plugins'),

      // Detect running Adobe apps (Premiere Pro / After Effects)
      checkRunningAdobeApps: () =>
        ipcRenderer.invoke('check-running-adobe-apps'),
      startWatchingAdobeApps: () =>
        ipcRenderer.send('start-watching-adobe-apps'),
      stopWatchingAdobeApps: () => ipcRenderer.send('stop-watching-adobe-apps'),
      onAdobeAppsChanged: (callback) => {
        const subscription = (_event, state) => callback(state)
        ipcRenderer.on('adobe-apps-changed', subscription)
        return () =>
          ipcRenderer.removeListener('adobe-apps-changed', subscription)
      }
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
