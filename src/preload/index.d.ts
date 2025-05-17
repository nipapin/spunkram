import { ElectronAPI } from '@electron-toolkit/preload'
import {
  LocalVersion,
  UpdateStatus,
  VersionData
} from '@common/interfaces/IVersions'
declare global {
  interface Window {
    // electron: ElectronAPI
    api: ElectronAPI
  }
}
interface ElectronAPI {
  // Version management
  getRemoteVersions: () => Promise<VersionData>
  getLocalVersion: () => Promise<LocalVersion | null>
  saveLocalVersion: (version: string, groupName: string) => Promise<boolean>
  checkUpdateStatus: () => Promise<UpdateStatus>

  // Extension download and installation
  downloadExtension: (version: string) => void
  onProgressUpdate: (callback: (progress: number) => void) => () => void
  onInstallationComplete: (
    callback: (result: {
      success: boolean
      path?: string
      error?: string
    }) => void
  ) => void
  onUninstallationComplete: (
    callback: (result: {
      success: boolean
      path?: string
      error?: string
    }) => void
  ) => void
  uninstallExtension: () => void
}

export {}
