import { ipcMain, WebContents } from 'electron'
import { exec } from 'child_process'

export type AdobeApp = 'premiere' | 'afterEffects'
export type AdobeAppsState = Record<AdobeApp, boolean>

// У одной и той же программы может быть несколько имён процесса между версиями:
// в Premiere 26 Adobe выкинул слово "Pro" из имени бинарника
// ("Adobe Premiere Pro.exe" → "Adobe Premiere.exe").
const PROCESS_NAMES: Record<AdobeApp, { win: string[]; mac: string[] }> = {
  premiere: {
    win: ['Adobe Premiere Pro.exe', 'Adobe Premiere.exe'],
    mac: ['Adobe Premiere Pro', 'Adobe Premiere']
  },
  afterEffects: {
    // На Windows стабильно AfterFX.exe между версиями.
    // На macOS — "Adobe After Effects YYYY", ловим подстрокой.
    win: ['AfterFX.exe'],
    mac: ['Adobe After Effects']
  }
}

const POLL_INTERVAL_MS = 2000

function isProcessRunning(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // /NH — без шапки, /FO CSV — машинно-парсимый вывод.
      // Если процесс не найден, tasklist пишет в stdout "INFO: No tasks are running...".
      exec(
        `tasklist /FI "IMAGENAME eq ${name}" /NH /FO CSV`,
        { windowsHide: true },
        (err, stdout) => {
          if (err) return resolve(false)
          resolve(stdout.toLowerCase().includes(name.toLowerCase()))
        }
      )
    } else {
      // pgrep -i: подстрока, регистронезависимо. Без -x чтобы "Adobe After Effects 2024" попал.
      // exit 0 — найдено, 1 — нет, остальные — ошибка (трактуем как "не запущен").
      exec(`pgrep -i "${name}"`, (err) => resolve(!err))
    }
  })
}

async function isRunning(app: AdobeApp): Promise<boolean> {
  const names =
    process.platform === 'win32'
      ? PROCESS_NAMES[app].win
      : PROCESS_NAMES[app].mac
  const results = await Promise.all(names.map(isProcessRunning))
  return results.some(Boolean)
}

async function snapshot(): Promise<AdobeAppsState> {
  const [premiere, afterEffects] = await Promise.all([
    isRunning('premiere'),
    isRunning('afterEffects')
  ])
  return { premiere, afterEffects }
}

function statesEqual(a: AdobeAppsState | null, b: AdobeAppsState): boolean {
  return !!a && a.premiere === b.premiere && a.afterEffects === b.afterEffects
}

export function registerRunningAppsHandlers(): void {
  ipcMain.handle('check-running-adobe-apps', () => snapshot())

  const subscribers = new Set<WebContents>()
  let pollTimer: NodeJS.Timeout | null = null
  let lastState: AdobeAppsState | null = null

  const tick = async (): Promise<void> => {
    const state = await snapshot()
    const changed = !statesEqual(lastState, state)
    lastState = state
    if (!changed) return
    for (const wc of subscribers) {
      if (!wc.isDestroyed()) wc.send('adobe-apps-changed', state)
    }
  }

  const ensurePolling = (): void => {
    if (pollTimer) return
    void tick()
    pollTimer = setInterval(() => void tick(), POLL_INTERVAL_MS)
  }

  const stopIfIdle = (): void => {
    if (subscribers.size > 0 || !pollTimer) return
    clearInterval(pollTimer)
    pollTimer = null
    lastState = null
  }

  ipcMain.on('start-watching-adobe-apps', (event) => {
    subscribers.add(event.sender)
    event.sender.once('destroyed', () => {
      subscribers.delete(event.sender)
      stopIfIdle()
    })
    ensurePolling()
  })

  ipcMain.on('stop-watching-adobe-apps', (event) => {
    subscribers.delete(event.sender)
    stopIfIdle()
  })
}
