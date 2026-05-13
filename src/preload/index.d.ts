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
  fetchLinks: () => Promise<Record<string, string>>

  // Native plugin bundles (CSBridge etc.)
  checkPlugins: () => Promise<string[]>
  installPlugins: () => Promise<{
    success: boolean
    installed?: string[]
    alreadyPresent?: boolean
    error?: string
  }>

  // Detect running Adobe apps (Premiere Pro / After Effects)
  checkRunningAdobeApps: () => Promise<AdobeAppsState>
  startWatchingAdobeApps: () => void
  stopWatchingAdobeApps: () => void
  onAdobeAppsChanged: (callback: (state: AdobeAppsState) => void) => () => void
}

export interface AdobeAppsState {
  premiere: boolean
  afterEffects: boolean
}

export {}
