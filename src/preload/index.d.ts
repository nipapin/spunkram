import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    // electron: ElectronAPI
    api: ElectronAPI
  }
}
interface ElectronAPI {
  downloadExtension: (url: string, extensionName: string) => void
  onProgressUpdate: (callback: (progress: number) => void) => () => void
  onInstallationComplete: (
    callback: (result: {
      success: boolean
      path?: string
      error?: string
    }) => void
  ) => void
}

export {}
