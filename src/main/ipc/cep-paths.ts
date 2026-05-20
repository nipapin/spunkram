import { app } from 'electron'
import { dirname, join } from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { EXTENSION_NAME } from '@common/constants'

export type PluginEntry = {
  file: string
  folder: string
  /**
   * macOS: установить в `<установленное CEP-расширение>/bin/mac`, а не в `folder`.
   * Для таких записей `folder` может быть пустой строкой.
   */
  installUnderCEPBinMac?: boolean
}

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
      folder:
        '/Library/Application Support/Adobe/Common/Plug-ins/ControlSurface'
    },
    {
      file: 'MotionflowInit.bundle',
      folder:
        '/Library/Application Support/Adobe/Common/Plug-ins/7.0/MediaCore'
    },
    {
      file: 'Motionflow.bundle',
      folder: '',
      installUnderCEPBinMac: true
    }
  ]
}

/**
 * Каталог установки для одной записи CSBridge (с учётом macOS → CEP `bin/mac`).
 */
export function resolveCSBridgePluginDestDir(
  p: PluginEntry,
  platform: NodeJS.Platform
): string | null {
  if (platform === 'darwin' && p.installUnderCEPBinMac) {
    const ext = findInstalledCEPExtensionPath(EXTENSION_NAME)
    return ext ? join(ext, 'bin', 'mac') : null
  }
  return p.folder ? p.folder : null
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
  const nodePlatform = process.platform
  return CSBridge[platform]
    .filter((p) => {
      const dir = resolveCSBridgePluginDestDir(p, nodePlatform)
      if (!dir) return true
      return !fs.existsSync(join(dir, p.file))
    })
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
export function findInstalledCEPExtensionPath(
  extensionName: string
): string | null {
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

/**
 * Проверяет, можно ли создать/перезаписать содержимое в указанной директории
 * без админских прав. Учитывает как сам факт существования, так и реальные
 * права на запись родителя (важно для system-path типа /Library/...).
 */
export function isPathWritableByCurrentUser(p: string): boolean {
  try {
    if (fs.existsSync(p)) {
      fs.accessSync(p, fs.constants.W_OK)
      return true
    }
    // Если самой папки нет — проверяем ближайшего существующего родителя.
    let parent = p
    while (parent && parent !== dirname(parent)) {
      parent = dirname(parent)
      if (fs.existsSync(parent)) {
        fs.accessSync(parent, fs.constants.W_OK)
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Выбор каталога для установки CEP-расширения.
 *
 * Стратегия:
 *   1) Если расширение уже стоит где-то (system / user) — переустанавливаем туда же,
 *      чтобы не плодить две копии (system-копия CEP'ом грузится в приоритете
 *      и перебивала бы новую user-копию).
 *   2) Иначе предпочитаем user-каталог: он не требует админ-прав и достаточен для CEP.
 *
 * Возвращает выбранный путь и флаг needsAdmin — true если для записи туда
 * текущему пользователю не хватает прав (system-path под обычным юзером).
 */
export function chooseCEPInstallTarget(extensionName: string): {
  path: string
  isSystemWide: boolean
  needsAdmin: boolean
} {
  const [systemPath, userPath] = getCEPExtensionCandidatePaths(extensionName)

  // 1) Если уже что-то стоит — переустанавливаем туда же.
  const existing = findInstalledCEPExtensionPath(extensionName)
  if (existing) {
    return {
      path: existing,
      isSystemWide: existing === systemPath,
      needsAdmin:
        existing === systemPath && !isPathWritableByCurrentUser(systemPath)
    }
  }

  // 2) Фолбэк — user-каталог.
  return {
    path: userPath,
    isSystemWide: false,
    needsAdmin: !isPathWritableByCurrentUser(userPath)
  }
}
