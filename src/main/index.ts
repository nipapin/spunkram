import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { setupDownloadHandlers } from './ipc/download-handlers'
import { registerFetchLinksHandlers } from './ipc/fetchLinks'
import { registerVersionHandlers } from './ipc/get-versions'
import { registerInstallPluginsHandlers } from './ipc/install-plugins'
import { registerRunningAppsHandlers } from './ipc/running-apps'

const preloadPath = join(__dirname, '../preload/index.js')

function hideApplicationMenu(): void {
  // On macOS, setApplicationMenu(null) does not clear the native menu (Electron returns early).
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([]))
  } else {
    Menu.setApplicationMenu(null)
  }
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    // webPreferences: {
    //   preload: preloadPath,
    //   nodeIntegration: false,
    //   contextIsolation: true,
    //   sandbox: false
    // }

    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      // другие настройки...
      partition: 'persist:app', // Использование отдельного хранилища
      // В production режиме отключаем кэширование
      ...(process.env.NODE_ENV === 'production'
        ? {
            webSecurity: true,
            allowRunningInsecureContent: false
          }
        : {})
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  hideApplicationMenu()

  // Очистка кэша при запуске
  // await app.getPath('userData')
  // await session.defaultSession.clearCache()
  // await session.defaultSession.clearStorageData({
  //   storages: [
  //     'cookies',
  //     'filesystem',
  //     'indexdb',
  //     'localstorage',
  //     'shadercache',
  //     'websql',
  //     'serviceworkers'
  //   ]
  // })
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    hideApplicationMenu()
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Register IPC download zxp handlers
  setupDownloadHandlers()
  // Register all IPC handlers
  registerVersionHandlers()
  registerFetchLinksHandlers()
  registerInstallPluginsHandlers()
  registerRunningAppsHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
