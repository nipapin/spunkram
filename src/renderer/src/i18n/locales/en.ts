export default {
  common: {
    refresh: 'Refresh data',
    cancel: 'Cancel',
    back: 'Back',
    tryAgain: 'Try again',
    copyError: 'Copy error',
    reportBug: 'Report bug'
  },
  language: {
    label: 'Language',
    en: 'English',
    tr: 'Türkçe'
  },
  badge: {
    installed: 'Installed',
    beta: 'Beta',
    latest: 'Latest'
  },
  notInstalled: {
    title: 'Spunkram',
    titleAccent: 'Extension',
    description:
      'Install once, then browse and apply Spunkram projects directly inside Adobe Premiere Pro and After Effects.',
    compatNote: 'CC 2023+',
    installButton: 'Install Spunkram',
    uninstalledNote:
      'Spunkram has been removed. Install again whenever you like.'
  },
  installing: {
    title: 'Installing Spunkram',
    subtitle: "Please don't close the window — this won't take long.",
    downloading: 'Downloading…',
    finalizing: 'Finalizing…',
    stepDownload: 'Downloading extension package',
    stepInstall: 'Installing into Adobe CEP'
  },
  installed: {
    betaInstalled: 'Beta v{version} installed',
    upToDate: 'You have the latest version',
    updateAvailable: 'Update available',
    updateHint: "You're on {current} — newer {latest} is available.",
    openHint:
      'Open Premiere Pro or After Effects and find Spunkram in the menu:',
    pathOpen: 'Open',
    installStable: 'Install stable v{version}',
    update: 'Update to v{version}',
    reinstall: 'Reinstall',
    uninstallTitle: 'Uninstall Spunkram',
    betaWarning:
      "You're using a beta build. If you find a bug, please report it."
  },
  error: {
    title: 'Something went wrong',
    adobeLockedHint:
      'Adobe Premiere Pro or After Effects appears to be open and holding installer files. Close all Adobe apps and try again.',
    pluginSourceMissingHint:
      'The installer is missing plugin source files. Try downloading the installer again.',
    networkHint:
      'The download failed — check your internet connection and try again.'
  },
  status: {
    installed: 'Spunkram installed successfully',
    refreshed: 'Data refreshed',
    refreshFailed: 'Failed to refresh',
    installFailed: 'Failed to install',
    uninstallFailed: 'Failed to uninstall',
    uninstalled: 'Spunkram has been uninstalled',
    apiUnavailable: 'API Preload unavailable',
    installingPlugins: 'Installing required plugins…',
    pluginsAlreadyInstalled: 'Plugins already installed',
    pluginsInstalled: 'Installed {count} plugin(s)',
    pluginsFailed: 'Failed to install plugins'
  },
  uninstallModal: {
    title: 'Uninstall Spunkram?',
    message:
      'This will remove the Spunkram extension from Adobe CEP. You can reinstall it anytime.',
    confirm: 'Uninstall'
  },
  closeAdobeModal: {
    title: 'Close Adobe applications',
    descriptionOne:
      "The installer can't continue while {apps} is running. Close it and the installation will resume automatically.",
    descriptionMany:
      "The installer can't continue while {apps} are running. Close them and the installation will resume automatically.",
    allClosed: 'All apps are closed, continuing…'
  },
  versions: {
    chooseVersionTitle: 'Choose version ({count} available)',
    available: 'Available versions',
    total: '{count} total',
    groupStable: 'Stable',
    groupBeta: 'Beta'
  },
  quickLinks: {
    docs: 'Documentation',
    changelog: "What's new",
    bug: 'Report bug',
    website: 'Website'
  }
}
