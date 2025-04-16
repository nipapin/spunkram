export interface VersionList {
  stable: Array<{
    name: string
    date: string
    action: string
  }>
  /** Бета-версии */
  beta: Array<{
    name: string
    date: string
    action: string
  }>
}

/**
 * Интерфейс для данных о версиях приложения
 */
export interface VersionData {
  /** Списки версий по категориям */
  list: VersionList
  /** Фиксированные/текущие версии */
  fixed: {
    stable: string
    beta: string
  }
}

/**
 * Интерфейс для информации о локально установленной версии
 */
export interface LocalVersion {
  /** Номер установленной версии */
  version: string
  /** Дата и время установки в формате ISO */
  installedAt: string
}

/**
 * Интерфейс для статуса обновлений
 */
export interface UpdateStatus {
  /** Флаг, указывающий установлено ли приложение */
  installed: boolean
  /** Текущая установленная версия или null, если не установлено */
  updateAvailable: boolean
  currentVersion: string | null
  versions: VersionList
  /** Последняя доступная стабильная версия */
  latestVersion: string

  latestBeta?: string
}
