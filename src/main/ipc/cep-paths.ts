import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import * as os from 'os'

export type PluginEntry = { file: string; folder: string }

/**
 * Целевые пути для CSBridge-плагинов.
 * Здесь же должен поддерживаться актуальный список — install-plugins.ts
 * импортирует эту константу, чтобы не дублировать данные.
 */
export const CSBridge: { win: PluginEntry[]; mac: PluginEntry[] } = {
  win: [
    {
      file: 'MotionflowBridge.acsrf',
      folder: 'C:\\Program Files\\Adobe\\Common\\Plug-ins\\ControlSurface'
    },
    {
      file: 'MotionflowInit.prm',
      folder: 'C:\\Program Files\\Adobe\\Common\\Plug-ins\\7.0\\MediaCore'
    }
  ],
  mac: [
    {
      file: 'MotionflowBridge.bundle',
      folder: '/Library/Application Support/Adobe/Common/Plug-ins/ControlSurface'
    },
    {
      file: 'MotionflowInit.bundle',
      folder: '/Library/Application Support/Adobe/Common/Plug-ins/7.0/MediaCore'
    }
  ]
}

/**
 * Корень с распакованными плагинами внутри установщика.
 * В упакованной сборке это <resources>/plugins (см. build.extraResources).
 * В dev-режиме — исходники: <project>/resources/plugins/<os>.
 */
export function getPluginsRoot(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'plugins')
  }
  const subdir = process.platform === 'win32' ? 'win' : 'mac'
  return join(app.getAppPath(), 'resources', 'plugins', subdir)
}

/**
 * Возвращает имена CSBridge-файлов, которых сейчас НЕТ на диске.
 * Чисто read-only, никаких side-effects.
 */
export function getMissingCSBridgePlugins(): string[] {
  const platform: 'win' | 'mac' = process.platform === 'win32' ? 'win' : 'mac'
  return CSBridge[platform]
    .filter((p) => !fs.existsSync(join(p.folder, p.file)))
    .map((p) => p.file)
}

/**
 * Возможные пути установки CEP-расширения для текущей ОС.
 * Порядок соответствует приоритету в download-handlers.ts:
 * сначала system-wide, затем per-user.
 */
export function getCEPExtensionCandidatePaths(extensionName: string): string[] {
  const platform = os.platform()
  const homeDir = os.homedir()

  if (platform === 'win32') {
    const systemPath = join(
      'C:',
      'Program Files (x86)',
      'Common Files',
      'Adobe',
      'CEP',
      'extensions',
      extensionName
    )
    const userPath = join(
      process.env.APPDATA || '',
      'Adobe',
      'CEP',
      'extensions',
      extensionName
    )
    return [systemPath, userPath]
  }

  if (platform === 'darwin') {
    const systemPath = join(
      '/',
      'Library',
      'Application Support',
      'Adobe',
      'CEP',
      'extensions',
      extensionName
    )
    const userPath = join(
      homeDir,
      'Library',
      'Application Support',
      'Adobe',
      'CEP',
      'extensions',
      extensionName
    )
    return [systemPath, userPath]
  }

  return []
}

/**
 * Читает диск и возвращает первый существующий путь установки расширения,
 * либо null если расширение не найдено ни в system-, ни в user-каталоге.
 *
 * Папка считается реально существующей только если она содержит хотя бы
 * один файл — пустой каталог трактуется как "ничего не установлено"
 * (Adobe CEP такую папку игнорирует, и юзер мог удалить содержимое вручную).
 */
export function findInstalledCEPExtensionPath(extensionName: string): string | null {
  for (const candidate of getCEPExtensionCandidatePaths(extensionName)) {
    try {
      if (!fs.existsSync(candidate)) continue
      const stat = fs.statSync(candidate)
      if (!stat.isDirectory()) continue
      const entries = fs.readdirSync(candidate)
      if (entries.length === 0) continue
      return candidate
    } catch {
      // нет прав на чтение или гонка — считаем что не установлено по этому пути
      continue
    }
  }
  return null
}
