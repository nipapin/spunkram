<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import VersionsDropDown from './components/VersionsDropDown.vue'
import QuickLinks from './components/QuickLinks.vue'
import { URL_REPORT_BUG } from '@common/constants'
import ConfirmationModal from './components/ConfirmationModal.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'

const { t } = useI18n()

defineProps<{
  linksMap: Record<string, string>
}>()

type AppState =
  | 'not-installed'
  | 'installed'
  | 'update'
  | 'error'
  | 'uninstalled'

const isLoading = ref(false)
const isRefreshing = ref(false)
const downloadProgress = ref(0)
const installationStatus = ref('')
const errorDetails = ref('')
const currentState = ref<AppState>('not-installed')
const previousState = ref<AppState>('not-installed')

let progressUnsubscribe: (() => void) | null = null

const isConfirmationVisible = ref(false)

// --- Adobe apps detection --------------------------------------------------
const runningAdobeApps = ref<{ premiere: boolean; afterEffects: boolean }>({
  premiere: false,
  afterEffects: false
})
const isCloseAdobeModalVisible = ref(false)
let adobeAppsUnsubscribe: (() => void) | null = null

const hasRunningAdobeApps = computed(
  () => runningAdobeApps.value.premiere || runningAdobeApps.value.afterEffects
)

const runningAdobeAppsLabel = computed(() => {
  const list: string[] = []
  if (runningAdobeApps.value.premiere) list.push('Adobe Premiere Pro')
  if (runningAdobeApps.value.afterEffects) list.push('Adobe After Effects')
  if (list.length <= 1) return list.join('')
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
})

const runningAdobeAppsCount = computed(
  () =>
    (runningAdobeApps.value.premiere ? 1 : 0) +
    (runningAdobeApps.value.afterEffects ? 1 : 0)
)

const closeAdobeDescriptionKey = computed(() =>
  runningAdobeAppsCount.value > 1
    ? 'closeAdobeModal.descriptionMany'
    : 'closeAdobeModal.descriptionOne'
)

// Если пользователь нажал Install при открытом Premiere, мы запоминаем
// параметры здесь и автоматически продолжим установку, как только он закроет
// все Adobe-приложения (watcher это увидит).
const pendingInstall = ref<{ version?: string; group?: string } | null>(null)
// --------------------------------------------------------------------------

const setState = (next: AppState): void => {
  if (next !== 'error' && currentState.value !== 'error') {
    previousState.value = currentState.value
  }
  currentState.value = next
}

watch(installationStatus, (newValue) => {
  if (newValue) {
    setTimeout(() => {
      installationStatus.value = ''
    }, 3000)
  }
})

const objectOriginData = ref<{
  installed: boolean
  currentVersion: string | null
  currentGroup: string | null
  latestVersion: string
  versions: { stable: any[]; beta: any[]; latestVersion?: string }
} | null>(null)

const loadVersionData = async (): Promise<{
  installed: boolean
  currentVersion: string | null
  currentGroup: string | null
  latestVersion: string
  versions: { stable: any[]; beta: any[]; latestVersion?: string }
}> => {
  const getUpdaterVersionData = await window.api.checkUpdateStatus()
  objectOriginData.value = {
    ...getUpdaterVersionData,
    versions: {
      ...getUpdaterVersionData.versions,
      stable: getUpdaterVersionData.versions.stable.sort((a, b) =>
        b.name.localeCompare(a.name)
      ),
      beta: getUpdaterVersionData.versions.beta.sort((a, b) =>
        b.name.localeCompare(a.name)
      )
    }
  }
  return getUpdaterVersionData
}

const refreshData = async (): Promise<void> => {
  if (isRefreshing.value || isLoading.value) return
  isRefreshing.value = true
  try {
    const data = await loadVersionData()
    setState(data.installed ? 'installed' : 'not-installed')
    installationStatus.value = t('status.refreshed')
  } catch (err) {
    installationStatus.value = t('status.refreshFailed')
    errorDetails.value = `Error: ${err instanceof Error ? err.message : err}`
    setState('error')
  } finally {
    isRefreshing.value = false
  }
}

const goBack = (): void => {
  errorDetails.value = ''
  const target =
    previousState.value === 'error' ? 'not-installed' : previousState.value
  currentState.value = target
}

onMounted(async () => {
  const data = await loadVersionData()
  currentState.value = data.installed ? 'installed' : 'not-installed'
  previousState.value = currentState.value

  try {
    runningAdobeApps.value = await window.api.checkRunningAdobeApps()
  } catch (err) {
    console.warn('[adobe-apps] initial check failed:', err)
  }

  adobeAppsUnsubscribe = window.api.onAdobeAppsChanged((state) => {
    runningAdobeApps.value = state

    // Юзер закрыл всё — если у нас отложенная установка, продолжаем её сами.
    if (
      !state.premiere &&
      !state.afterEffects &&
      pendingInstall.value &&
      isCloseAdobeModalVisible.value
    ) {
      const { version, group } = pendingInstall.value
      pendingInstall.value = null
      isCloseAdobeModalVisible.value = false
      installExtension(version, group)
    }
  })
  window.api.startWatchingAdobeApps()
})

onBeforeUnmount(() => {
  if (progressUnsubscribe) {
    progressUnsubscribe()
  }
  if (adobeAppsUnsubscribe) {
    adobeAppsUnsubscribe()
    adobeAppsUnsubscribe = null
  }
  window.api.stopWatchingAdobeApps()
})

const checkLatestVersion = computed(() => {
  if (!objectOriginData.value) return true
  return (
    objectOriginData.value.currentVersion ===
    objectOriginData.value.latestVersion
  )
})

const latestVersion = computed(
  () => objectOriginData.value?.latestVersion ?? ''
)
const currentVersion = computed(
  () => objectOriginData.value?.currentVersion ?? null
)
const currentGroup = computed(
  () => objectOriginData.value?.currentGroup ?? null
)

const copyErrToClipboard = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(errorDetails.value)
  } catch (err) {
    console.error(err)
  }
}

const uninstallExtension = async (): Promise<void> => {
  isLoading.value = true
  isConfirmationVisible.value = false
  try {
    window.api.onUninstallationComplete((result) => {
      isLoading.value = false
      if (result && result.success) {
        setTimeout(() => {
          if (objectOriginData.value) {
            objectOriginData.value = {
              ...objectOriginData.value,
              currentGroup: null,
              currentVersion: null
            }
          }
          installationStatus.value = t('status.uninstalled')
          setState('uninstalled')
        }, 400)
      } else {
        installationStatus.value = t('status.uninstallFailed')
        errorDetails.value = `Error: ${
          result && result.error ? result.error : 'Unknown uninstall error'
        }`
        setState('error')
      }
    })

    window.api.uninstallExtension()
  } catch (error) {
    installationStatus.value = t('status.uninstallFailed')
    errorDetails.value = `Error: ${error}`
    setState('error')
  }
}

const installExtension = (version?: string, groupName?: string): void => {
  if (isLoading.value) return
  if (!objectOriginData.value) return

  // Не пускаем установку, если открыт Premiere Pro / After Effects.
  // Запоминаем параметры — watcher сам продолжит, когда юзер всё закроет.
  if (hasRunningAdobeApps.value) {
    pendingInstall.value = { version, group: groupName }
    isCloseAdobeModalVisible.value = true
    return
  }

  downloadProgress.value = 0
  isLoading.value = true
  setState('update')

  const targetVersion = version ?? objectOriginData.value.latestVersion
  const targetGroup = groupName ?? 'stable'

  objectOriginData.value.currentVersion = targetVersion
  objectOriginData.value.currentGroup = targetGroup

  try {
    if (progressUnsubscribe) {
      progressUnsubscribe()
      progressUnsubscribe = null
    }

    if (window.api) {
      progressUnsubscribe = window.api.onProgressUpdate((progress) => {
        if (typeof progress === 'number') {
          downloadProgress.value = progress
        }
      })

      window.api.onInstallationComplete(async (result) => {
        if (result && result.success) {
          window.api.saveLocalVersion(targetVersion, targetGroup)
          if (objectOriginData.value) {
            objectOriginData.value.currentVersion = targetVersion
          }

          // После основной установки докатываем нативные плагины (CSBridge).
          // installPlugins сам проверит, чего не хватает, и попросит права через sudo-prompt.
          try {
            installationStatus.value = t('status.installingPlugins')
            const pluginsResult = await window.api.installPlugins()
            console.log('[plugins] installPlugins result:', pluginsResult)
            if (!pluginsResult.success) {
              isLoading.value = false
              progressUnsubscribe = null
              installationStatus.value = t('status.pluginsFailed')
              errorDetails.value = `Plugins error: ${
                pluginsResult.error ?? 'Unknown error'
              }`
              setState('error')
              return
            }
            if (pluginsResult.alreadyPresent) {
              installationStatus.value = t('status.pluginsAlreadyInstalled')
            } else {
              installationStatus.value = t('status.pluginsInstalled', {
                count: pluginsResult.installed?.length ?? 0
              })
            }
          } catch (pluginsErr) {
            isLoading.value = false
            progressUnsubscribe = null
            installationStatus.value = t('status.pluginsFailed')
            errorDetails.value = `Plugins error: ${
              pluginsErr instanceof Error
                ? pluginsErr.message
                : String(pluginsErr)
            }`
            setState('error')
            return
          }

          isLoading.value = false
          setTimeout(() => {
            installationStatus.value = t('status.installed')
            setState('installed')
          }, 400)
        } else {
          isLoading.value = false
          progressUnsubscribe = null
          installationStatus.value = t('status.installFailed')
          errorDetails.value = `Error: ${
            result && result.error ? result.error : 'Unknown download error'
          }`
          setState('error')
        }
      })

      window.api.downloadExtension(version ?? '')
    } else {
      installationStatus.value = t('status.apiUnavailable')
      isLoading.value = false
      errorDetails.value = installationStatus.value
      setState('error')
    }
  } catch (error) {
    installationStatus.value = t('status.installFailed')
    isLoading.value = false
    errorDetails.value = `Error: ${error || 'Unknown'}`
    setState('error')
  }
}

const installedBadgeText = computed(() => {
  if (!objectOriginData.value || !currentVersion.value) return ''
  if (currentGroup.value === 'beta')
    return `v${currentVersion.value} · ${t('badge.beta')}`
  return `v${currentVersion.value} · ${t('badge.installed')}`
})

const headerVersionText = computed(() => {
  if (!objectOriginData.value) return ''
  if (currentState.value === 'installed' && currentVersion.value) {
    return installedBadgeText.value
  }
  if (latestVersion.value) {
    return `v${latestVersion.value} · ${t('badge.latest')}`
  }
  return ''
})
</script>

<template>
  <section class="surface-card relative w-full">
    <!-- Card header -->
    <div
      class="flex items-center justify-between px-7 pt-6 pb-5 border-b border-white/5"
    >
      <div class="flex items-center gap-2.5">
        <span class="brand-mark">S</span>
        <span class="text-sm font-semibold text-white tracking-tight">
          Spunkram
        </span>
      </div>
      <div class="flex items-center gap-2">
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          leave-active-class="transition-all duration-200 ease-in"
          enter-from-class="opacity-0 translate-y-1"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <span
            v-if="headerVersionText"
            :key="headerVersionText"
            class="tag-badge"
            :class="{ 'is-success': currentState === 'installed' }"
          >
            <span
              v-if="currentState === 'installed'"
              class="w-1.5 h-1.5 rounded-full bg-success-500"
            />
            {{ headerVersionText }}
          </span>
        </Transition>
        <LanguageSwitcher />
        <button
          class="header-icon-btn"
          :class="{ 'is-spinning': isRefreshing }"
          :disabled="isLoading || isRefreshing"
          :title="$t('common.refresh')"
          @click="refreshData"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="w-3.5 h-3.5"
          >
            <path
              d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Card body: state-driven content -->
    <div class="px-7 py-7 min-h-[260px] flex flex-col">
      <TransitionGroup
        tag="div"
        class="relative flex-1"
        enter-active-class="transition-all duration-400 ease-out"
        leave-active-class="transition-all duration-200 ease-in absolute inset-0"
        enter-from-class="opacity-0 translate-y-1.5"
        enter-to-class="opacity-100 translate-y-0"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1.5"
      >
        <!-- NOT INSTALLED -->
        <div
          v-if="
            currentState === 'not-installed' || currentState === 'uninstalled'
          "
          key="not-installed"
        >
          <h1
            class="text-[28px] leading-[1.15] font-semibold text-white tracking-tight"
          >
            {{ $t('notInstalled.title') }}
            <span class="gradient-text">
              {{ $t('notInstalled.titleAccent') }}
            </span>
          </h1>
          <p
            class="mt-3 text-sm leading-relaxed max-w-[440px]"
            style="color: var(--color-text-muted)"
          >
            {{ $t('notInstalled.description') }}
          </p>

          <!-- Compatibility row -->
          <div class="mt-5 flex items-center gap-2">
            <span class="compat-chip">
              <span class="compat-dot" />
              Premiere Pro
            </span>
            <span class="compat-chip">
              <span class="compat-dot" />
              After Effects
            </span>
            <span class="text-[11px] text-text-muted ml-1">
              {{ $t('notInstalled.compatNote') }}
            </span>
          </div>

          <!-- Primary action row -->
          <div class="mt-6 flex items-center gap-2.5">
            <button
              class="btn-primary flex-1"
              :disabled="!objectOriginData"
              @click="installExtension()"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-4 h-4"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{{ $t('notInstalled.installButton') }}</span>
              <span
                v-if="latestVersion"
                class="opacity-70 text-xs font-medium ml-1"
              >
                v{{ latestVersion }}
              </span>
            </button>

            <VersionsDropDown
              v-if="objectOriginData"
              variant="compact"
              :versions="objectOriginData.versions"
              :current="latestVersion"
              :group="'stable'"
              :latest-version="latestVersion"
              @download-version="installExtension"
            />
          </div>

          <p
            v-if="currentState === 'uninstalled'"
            class="mt-3 text-xs"
            style="color: var(--color-text-dim)"
          >
            {{ $t('notInstalled.uninstalledNote') }}
          </p>
        </div>

        <!-- INSTALLING / DOWNLOADING -->
        <div v-else-if="currentState === 'update'" key="update">
          <h1
            class="text-[24px] leading-[1.2] font-semibold text-white tracking-tight"
          >
            {{ $t('installing.title') }}
            <span class="gradient-text">v{{ currentVersion }}</span>
          </h1>
          <p class="mt-2 text-sm" style="color: var(--color-text-muted)">
            {{ $t('installing.subtitle') }}
          </p>

          <!-- Linear progress -->
          <div class="mt-7">
            <div class="flex items-center justify-between mb-2">
              <span
                class="text-xs font-medium uppercase tracking-wider"
                style="color: var(--color-text-muted)"
              >
                <span v-if="downloadProgress < 100">
                  {{ $t('installing.downloading') }}
                </span>
                <span v-else>{{ $t('installing.finalizing') }}</span>
              </span>
              <span class="text-xs font-mono font-semibold text-white">
                {{ Math.round(downloadProgress) }}%
              </span>
            </div>
            <div class="progress-track">
              <div
                class="progress-fill"
                :style="{ width: `${downloadProgress}%` }"
              />
            </div>
          </div>

          <!-- Steps indicator -->
          <div class="mt-6 flex flex-col gap-2">
            <div
              class="step-item"
              :class="{ 'is-active': downloadProgress < 100 }"
            >
              <span class="step-dot" />
              <span>{{ $t('installing.stepDownload') }}</span>
            </div>
            <div
              class="step-item"
              :class="{
                'is-active': downloadProgress >= 100 && isLoading,
                'is-done': !isLoading && downloadProgress === 100
              }"
            >
              <span class="step-dot" />
              <span>{{ $t('installing.stepInstall') }}</span>
            </div>
          </div>
        </div>

        <!-- INSTALLED -->
        <div v-else-if="currentState === 'installed'" key="installed">
          <div class="flex items-start gap-3">
            <div class="success-icon shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-4 h-4"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <h1
                class="text-[22px] leading-[1.2] font-semibold text-white tracking-tight"
              >
                <span v-if="currentGroup === 'beta'">
                  {{
                    $t('installed.betaInstalled', { version: currentVersion })
                  }}
                </span>
                <span v-else-if="checkLatestVersion">
                  {{ $t('installed.upToDate') }}
                </span>
                <span v-else>{{ $t('installed.updateAvailable') }}</span>
              </h1>
              <p
                v-if="!checkLatestVersion && currentGroup !== 'beta'"
                class="mt-1.5 text-sm"
                style="color: var(--color-text-muted)"
              >
                <i18n-t keypath="installed.updateHint" tag="span">
                  <template #current>
                    <span class="font-mono text-white">
                      v{{ currentVersion }}
                    </span>
                  </template>
                  <template #latest>
                    <span class="font-mono text-white">
                      v{{ latestVersion }}
                    </span>
                  </template>
                </i18n-t>
              </p>
              <p
                v-else
                class="mt-1.5 text-sm"
                style="color: var(--color-text-muted)"
              >
                {{ $t('installed.openHint') }}
              </p>
            </div>
          </div>

          <!-- Path hint -->
          <div class="mt-4 px-4 py-3 rounded-xl menu-path">
            <span
              class="text-xs uppercase tracking-wider mr-2"
              style="color: var(--color-text-dim)"
            >
              {{ $t('installed.pathOpen') }}
            </span>
            <code>Window</code>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-3 h-3 inline-block mx-1.5 opacity-50"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <code>Extensions</code>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-3 h-3 inline-block mx-1.5 opacity-50"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <code>Spunkram</code>
          </div>

          <!-- Actions -->
          <div class="mt-5 flex items-center gap-2.5">
            <button
              v-if="!checkLatestVersion || currentGroup === 'beta'"
              class="btn-primary flex-1"
              @click="installExtension(latestVersion, 'stable')"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-4 h-4"
              >
                <path d="m9 12.75 3 3 3-3" />
                <path d="M12 15.75V3" />
                <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z" />
              </svg>
              <span v-if="currentGroup === 'beta'">
                {{ $t('installed.installStable', { version: latestVersion }) }}
              </span>
              <span v-else>
                {{ $t('installed.update', { version: latestVersion }) }}
              </span>
            </button>
            <button
              v-else
              class="btn-secondary flex-1"
              @click="
                installExtension(
                  currentVersion ?? undefined,
                  currentGroup ?? 'stable'
                )
              "
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-4 h-4"
              >
                <path
                  d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"
                />
              </svg>
              {{ $t('installed.reinstall') }}
            </button>

            <VersionsDropDown
              v-if="objectOriginData"
              variant="compact"
              :versions="objectOriginData.versions"
              :current="currentVersion ?? ''"
              :group="currentGroup ?? 'stable'"
              :latest-version="latestVersion"
              @download-version="installExtension"
            />

            <button
              class="btn-icon-danger"
              :title="$t('installed.uninstallTitle')"
              @click="isConfirmationVisible = true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-4 h-4"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>

          <p
            v-if="currentGroup === 'beta'"
            class="mt-3 text-[11px]"
            style="color: var(--color-text-dim)"
          >
            {{ $t('installed.betaWarning') }}
          </p>
        </div>

        <!-- ERROR -->
        <div
          v-else-if="currentState === 'error'"
          key="error"
          class="flex flex-col items-center text-center"
        >
          <div class="error-icon mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-4 h-4"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <h1
            class="text-[20px] leading-[1.2] font-semibold text-red-300 tracking-tight"
          >
            {{ $t('error.title') }}
          </h1>
          <p
            class="mt-1.5 text-sm select-text cursor-text break-words max-w-[420px]"
            style="color: var(--color-text-muted)"
          >
            {{ errorDetails }}
          </p>

          <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button class="btn-primary" @click="installExtension()">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-4 h-4"
              >
                <path
                  d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"
                />
              </svg>
              {{ $t('common.tryAgain') }}
            </button>
            <button class="btn-ghost" @click="goBack">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-4 h-4"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              {{ $t('common.back') }}
            </button>
            <button class="btn-ghost" @click="copyErrToClipboard">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-4 h-4"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                />
              </svg>
              {{ $t('common.copyError') }}
            </button>
            <a
              class="btn-ghost"
              :href="URL_REPORT_BUG"
              target="_blank"
              rel="noopener"
            >
              {{ $t('common.reportBug') }}
            </a>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Quick links footer -->
    <div class="px-7 py-4 border-t border-white/5">
      <QuickLinks :links-map="linksMap" />
    </div>
  </section>

  <!-- Toast -->
  <Transition
    name="slide-fade"
    enter-active-class="transition duration-400 ease-out"
    leave-active-class="transition duration-300 ease-in"
    enter-from-class="transform translate-y-3 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-3 opacity-0"
    class="fixed bottom-6 left-1/2 -translate-x-1/2 z-20"
  >
    <div
      v-if="installationStatus"
      class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl border border-white/10"
      style="
        background: rgba(20, 20, 31, 0.95);
        backdrop-filter: blur(20px);
        box-shadow:
          0 20px 40px -12px rgba(0, 0, 0, 0.6),
          0 0 0 1px rgba(124, 58, 237, 0.2);
      "
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="w-4 h-4 text-success-500"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {{ installationStatus }}
    </div>
  </Transition>

  <ConfirmationModal
    :is-visible="isConfirmationVisible"
    :title="$t('uninstallModal.title')"
    :message="$t('uninstallModal.message')"
    :confirm-label="$t('uninstallModal.confirm')"
    :cancel-label="$t('common.cancel')"
    @confirm="uninstallExtension"
    @cancel="isConfirmationVisible = false"
  />

  <!-- Adobe apps blocking modal -->
  <Transition name="modal">
    <div
      v-if="isCloseAdobeModalVisible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-black/70 backdrop-transition"
        style="backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px)"
      />
      <div
        class="relative rounded-2xl p-7 max-w-sm w-full content-transition border border-white/10"
        style="
          background: rgba(17, 17, 28, 0.96);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.85);
        "
      >
        <div class="flex items-start gap-3">
          <div
            class="inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
            style="
              background: rgba(251, 191, 36, 0.14);
              border: 1px solid rgba(251, 191, 36, 0.3);
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="w-4.5 h-4.5 text-amber-300"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-base font-semibold text-white">
              {{ $t('closeAdobeModal.title') }}
            </h3>
            <p
              class="mt-1.5 text-sm leading-relaxed"
              style="color: var(--color-text-muted)"
            >
              {{
                $t(closeAdobeDescriptionKey, { apps: runningAdobeAppsLabel })
              }}
            </p>

            <div class="mt-4 flex flex-col gap-1.5">
              <div
                v-if="runningAdobeApps.premiere"
                class="flex items-center gap-2 text-xs"
                style="color: var(--color-text-muted)"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  style="background: #fbbf24"
                />
                Adobe Premiere Pro
              </div>
              <div
                v-if="runningAdobeApps.afterEffects"
                class="flex items-center gap-2 text-xs"
                style="color: var(--color-text-muted)"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  style="background: #fbbf24"
                />
                Adobe After Effects
              </div>
              <div
                v-if="!hasRunningAdobeApps"
                class="flex items-center gap-2 text-xs"
                style="color: var(--color-success-500, #22c55e)"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  style="background: #22c55e"
                />
                {{ $t('closeAdobeModal.allClosed') }}
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            class="modal-btn modal-btn-secondary"
            @click="
              () => {
                isCloseAdobeModalVisible = false
                pendingInstall = null
              }
            "
          >
            {{ $t('common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Header icon button (refresh) */
.header-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text-muted);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s;
}
.header-icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text);
  border-color: rgba(255, 255, 255, 0.18);
}
.header-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.header-icon-btn.is-spinning svg {
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Primary CTA pill */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 18px;
  border-radius: 12px;
  background: var(--grad-primary);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.005em;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 8px 24px -8px rgba(124, 58, 237, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  transition:
    transform 0.15s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
  cursor: pointer;
  white-space: nowrap;
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.08);
  box-shadow:
    0 14px 32px -8px rgba(124, 58, 237, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
}
.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Secondary outline button */
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 18px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
  cursor: pointer;
  white-space: nowrap;
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.18);
}

/* Ghost button */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: background 0.2s ease;
  cursor: pointer;
}
.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Icon-only danger */
.btn-icon-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text-muted);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s;
  cursor: pointer;
  flex-shrink: 0;
}
.btn-icon-danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.25);
}

/* Compatibility chip */
.compat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--color-text);
}
.compat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a78bfa, #6d28d9);
}

/* Linear progress */
.progress-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  position: relative;
}
.progress-fill {
  height: 100%;
  background: var(--grad-primary);
  border-radius: 999px;
  transition: width 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow: 0 0 12px rgba(124, 58, 237, 0.5);
  position: relative;
  overflow: hidden;
}
.progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.25),
    transparent
  );
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Step indicator rows */
.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--color-text-dim);
  transition: color 0.2s;
}
.step-item .step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  transition: all 0.3s;
}
.step-item.is-active {
  color: var(--color-text);
}
.step-item.is-active .step-dot {
  background: var(--color-secondary);
  box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.18);
  animation: pulse-dot 1.4s infinite;
}
.step-item.is-done {
  color: var(--color-text);
}
.step-item.is-done .step-dot {
  background: #10b981;
}
@keyframes pulse-dot {
  0%,
  100% {
    box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.18);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(124, 58, 237, 0.05);
  }
}

/* Success / error icons */
.success-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(16, 185, 129, 0.14);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
}
.error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.14);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
}

/* Menu path display */
.menu-path {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--color-text);
}
.menu-path code {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 12px;
  color: var(--color-text);
}

/* Reused modal styles (mirrors ConfirmationModal.vue) */
.modal-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.2s,
    border-color 0.2s,
    filter 0.2s;
  border: 1px solid transparent;
}
.modal-btn-secondary {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text);
  border-color: rgba(255, 255, 255, 0.1);
}
.modal-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.content-transition {
  transition: all 0.25s ease;
}
.modal-enter-from .content-transition,
.modal-leave-to .content-transition {
  opacity: 0;
  transform: scale(0.94);
}

.backdrop-transition {
  transition: opacity 0.25s ease;
}
.modal-enter-from .backdrop-transition,
.modal-leave-to .backdrop-transition {
  opacity: 0;
}
</style>
