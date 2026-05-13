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

  group?: string
  /** Дата и время установки в формате ISO */
  installedAt: string
}

/**
 * Интерфейс для статуса обновлений
 */
export interface UpdateStatus {
  /**
   * Флаг "приложение реально установлено".
   * true только если есть и JSON-файл с версией, и папка CEP-расширения на диске.
   */
  installed: boolean
  /** Текущая установленная версия или null, если не установлено */
  updateAvailable: boolean
  currentVersion: string | null
  currentGroup: string | null
  versions: VersionList
  /** Последняя доступная стабильная версия */
  latestVersion: string

  latestBeta?: string

  /**
   * Состояние установки на диске.
   * Позволяет UI отличать "никогда не ставилось" от "сломанная установка"
   * и показывать предупреждения о пропавших нативных плагинах.
   */
  diskState: {
    /** Найден ли наш JSON-маркер с записанной версией */
    versionFileExists: boolean
    /**
     * Путь до реально найденной папки CEP-расширения, либо null.
     * null означает: либо никогда не ставили, либо удалили вручную.
     */
    extensionPath: string | null
    /** Имена нативных плагинов CSBridge, которых сейчас нет на диске */
    pluginsMissing: string[]
  }
}
