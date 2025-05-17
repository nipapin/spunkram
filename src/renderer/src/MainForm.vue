<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue'
import VersionsDropDown from './components/VersionsDropDown.vue'
import {
  EXTENSION_NAME,
  URL_REPORT_BUG,
  URL_HELP_INSTALL_MANUALLY
} from '@common/constants'
import ConfirmationModal from './components/ConfirmationModal.vue'

const isLoading = ref(false)
const downloadProgress = ref(0)
const installationStatus = ref('')
const errorDetails = ref('')
const currentState = ref('not-installed')

// Добавляем правильное объявление переменной
let progressUnsubscribe: (() => void) | null = null

const isConfirmationVisible = ref(false)

watch(installationStatus, (newValue) => {
  if (newValue) {
    setTimeout(() => {
      installationStatus.value = ''
    }, 3000)
  }
})

onMounted(async () => {
  const checkUpdateStatus = await window.api.checkUpdateStatus()
  objectUpdateData.value = checkUpdateStatus
  currentState.value = checkUpdateStatus.installed
    ? 'installed'
    : 'not-installed'
})

// Очищаем подписки при размонтировании компонента
onBeforeUnmount(() => {
  if (progressUnsubscribe) {
    progressUnsubscribe()
  }
})

const objectUpdateData = ref()

const checkLatestVersion = computed(() => {
  return (
    objectUpdateData.value.currentVersion ===
    objectUpdateData.value.latestVersion
  )
})

const copyErrToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(errorDetails.value)
    console.log('Текст скопирован в буфер обмена')
  } catch (err) {
    console.error('Не удалось скопировать текст: ', err)
  }
}

const uninstallExtension = async () => {
  isLoading.value = true
  isConfirmationVisible.value = false
  try {
    window.api.onUninstallationComplete((result) => {
      console.log('Получен результат удаления:', result)
      isLoading.value = false
      if (result && result.success) {
        setTimeout(() => {
          installationStatus.value = 'The extension has been uninstalled!'
          currentState.value = 'uninstalled'
        }, 500)
      } else {
        installationStatus.value = 'Failed to uninstall the extension'
        currentState.value = 'error'
        errorDetails.value = `Error: ${result && result.error ? result.error : 'Unknown uninstall error'}`
      }
    })

    window.api.uninstallExtension()
  } catch (error) {
    installationStatus.value = 'Catch Error: Failed to uninstall the extension'
    currentState.value = 'error'
    errorDetails.value = `Error: ${error}`
  }
}

const installExtension = async (version?: string, groupName?: string) => {
  if (isLoading.value) return
  downloadProgress.value = 0
  isLoading.value = true
  currentState.value = version ? 'update' : 'not-installed'
  objectUpdateData.value.versionManually = version ?? null
  objectUpdateData.value.currentGroup = groupName ?? 'stable'
  try {
    // Отписываемся от предыдущих обновлений, если они есть
    if (progressUnsubscribe) {
      progressUnsubscribe()
      progressUnsubscribe = null
    }

    // Проверяем доступность API
    if (window.api) {
      console.log('electron доступен, настраиваем слушатели')

      // Подписываемся на обновления прогресса
      progressUnsubscribe = window.api.onProgressUpdate((progress) => {
        // console.log('Получено обновление прогресса:', progress)
        if (typeof progress === 'number') {
          downloadProgress.value = progress
        }
      })

      // Подписываемся на завершение установки
      window.api.onInstallationComplete((result) => {
        console.log('Получен результат установки:', result)
        isLoading.value = false
        if (result && result.success) {
          window.api.saveLocalVersion(
            version ?? objectUpdateData.value.latestVersion,
            groupName ?? 'stable'
          )
          objectUpdateData.value.currentVersion =
            version ?? objectUpdateData.value.latestVersion
          setTimeout(() => {
            installationStatus.value =
              'The extension has been installed successfully!'

            currentState.value = 'installed'
          }, 500)
        } else {
          progressUnsubscribe = null
          installationStatus.value = 'Failed to install the extension'
          currentState.value = 'error'
          errorDetails.value = `Error: ${result && result.error ? result.error : 'Unknown downloading error'}`
        }
      })

      // Отправляем запрос на загрузку и установку
      window.api.downloadExtension(version ?? '')
    } else {
      console.error('electron недоступен')
      installationStatus.value = 'API Preload unvailable'
      currentState.value = 'error'
      isLoading.value = false
      errorDetails.value = installationStatus.value
    }
  } catch (error) {
    console.error('Ошибка:', error)
    installationStatus.value = 'Catch Error: Failed to install the extension'
    currentState.value = 'error'
    isLoading.value = false
    errorDetails.value = `Catch Error: ${error || 'Unknown main error'}`
  }
}

const radius = 45
const circumference = computed(() => 2 * Math.PI * radius)
const strokeOffset = computed(
  () =>
    circumference.value - (downloadProgress.value / 100) * circumference.value
)
</script>
<template>
  <div class="flex flex-col items-center justify-center">
    <TransitionGroup
      tag="div"
      enter-active-class="transition-all duration-700 ease-out"
      leave-active-class="transition-all duration-500 ease-in"
      enter-from-class="opacity-0 blur-sm transform translate-y-2"
      enter-to-class="opacity-100 blur-none transform translate-y-0"
      leave-from-class="opacity-100 blur-none transform translate-y-0"
      leave-to-class="opacity-0 blur-sm transform translate-y-2"
      class="relative w-full flex justify-center"
    >
      <div
        v-if="currentState === 'not-installed'"
        key="not-installed"
        class="font-mono text-xl font-semibold text-gray-200 absolute text-center"
      >
        <span class="text-xl font-semibold text-gray-200"
          >Click the button to</span
        >
        <span
          class="block mt-1 text-2xl font-bold text-primary-500 text-nowrap"
        >
          > install_extension(<strong class="text-white">{{
            EXTENSION_NAME
          }}</strong
          >);</span
        >
      </div>

      <!-- Состояние 2: Установлено -->
      <div
        v-if="currentState === 'installed'"
        key="installed"
        class="font-mono text-xl font-semibold text-success-400 absolute text-center text-nowrap"
        :class="{
          'text-success-400': checkLatestVersion,
          'text-warning': !checkLatestVersion
        }"
      >
        <span v-if="objectUpdateData.currentGroup == 'stable'" class="block">{{
          checkLatestVersion
            ? 'You have the latest version!'
            : `Version ${objectUpdateData.currentVersion} is out of date!`
        }}</span>

        <span v-else>Test beta version installed</span>
      </div>
      <div
        v-if="currentState === 'update'"
        key="update"
        class="font-mono text-xl font-semibold text-primary-500 absolute text-center text-nowrap"
      >
        <span class="block"
          >Downloading version
          {{
            objectUpdateData.versionManually ?? objectUpdateData.currentVersion
          }}</span
        >
      </div>
      <!-- Состояние 3: Ошибка -->
      <div
        v-if="currentState === 'error'"
        key="error"
        class="absolute text-center text-nowrap"
      >
        <div class="font-mono font-semibold text-red-400 text-xl">
          An error occurred
        </div>

        <div
          class="text-white pointer-events-auto cursor-text mt-1 select-text text-wrap"
        >
          {{ errorDetails }}
        </div>

        <div class="flex items-center justify-center gap-2 my-4 text-white">
          <button class="btn" @click="installExtension()">Try Again</button>
          <button class="btn" @click="copyErrToClipboard">
            Copy to Clipboard
          </button>
          <a class="btn" :href="URL_REPORT_BUG" target="_blank">Bug Report</a>
        </div>
        <a
          :href="URL_HELP_INSTALL_MANUALLY"
          target="_blank"
          class="link inline-block"
          >How to install manually?</a
        >
      </div>
      <div
        v-if="currentState === 'uninstalled'"
        key="uninstalled"
        class="absolute text-center text-nowrap"
      >
        <div class="font-mono font-semibold text-white text-xl">
          Extension successfully removed!
        </div>
        <span class="text-gray-400 font-semibold"
          >If you want, you can install it again in the future!</span
        >
      </div>
    </TransitionGroup>

    <!-- Кнопка первичной загрузки -->
    <div
      v-if="['not-installed', 'update', 'uninstalled'].includes(currentState)"
      class="relative size-28 flex items-center justify-center mx-auto"
      :class="currentState === 'not-installed' ? 'top-20' : 'top-14'"
    >
      <svg class="absolute top-0 left-0 w-full h-full" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          class="stroke-blue-400 transition-all"
          :class="
            isLoading
              ? 'opacity-25 ease-in-out duration-200'
              : 'opacity-0 ease-out duration-200'
          "
          stroke-width="6"
        />
        <circle
          :class="
            isLoading
              ? 'transition-all'
              : 'opacity-0 transition-opacity duration-500'
          "
          class="progress-ring__circle"
          stroke="#3b82f6"
          stroke-width="6"
          stroke-linecap="round"
          fill="none"
          cx="50"
          cy="50"
          r="45"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="strokeOffset"
        />
      </svg>

      <button
        class="inset-0 relative flex items-center justify-center size-20 shrink-0 rounded-full hover:scale-105 transition-all duration-300 bg-primary-500 hover:bg-primary-600"
        :class="{
          'pointer-events-none': isLoading,
          'jump-animation shadow-pulse': downloadProgress === 100,
          'scale-110 bg-success-500': downloadProgress === 100 && !isLoading
        }"
        @click="installExtension()"
      >
        <span
          v-show="currentState === 'not-installed' && !isLoading"
          class="absolute inline-flex size-20 animate-ping rounded-full pointer-events-none bg-primary-500 opacity-25"
        ></span>

        <svg
          v-if="!isLoading"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-10"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <div v-else class="text-sm font-semibold text-white">
          {{ Math.round(downloadProgress) }}%
        </div>
      </button>
    </div>

    <div class="mt-10">
      <Transition
        enter-active-class="transition-all duration-700 ease-out"
        enter-from-class="h-0 opacity-0"
        enter-to-class="h-16 opacity-100"
      >
        <div
          v-if="currentState == 'installed'"
          class="w-2 bg-gradient-to-b from-success-500 to-primary-500 mx-auto rounded-full"
        ></div>
      </Transition>
      <Transition
        enter-active-class="transition-all duration-500 ease-out delay-700"
        leave-active-class="transition-all duration-300 ease-in"
        enter-from-class="opacity-0 transform scale-95"
        enter-to-class="opacity-100 transform scale-100"
        leave-from-class="opacity-100 transform scale-100"
        leave-to-class="opacity-0 transform scale-95"
      >
        <VersionsDropDown
          v-if="currentState == 'installed'"
          :versions="objectUpdateData.versions"
          :current="objectUpdateData.currentVersion"
          :latest-version="objectUpdateData.latestVersion"
          :check-latest="checkLatestVersion"
          @download-version="installExtension"
          @uninstall="isConfirmationVisible = true"
        />
      </Transition>
    </div>
  </div>
  <span
    v-if="
      currentState === 'installed' && objectUpdateData.currentGroup != 'stable'
    "
    class="text-gray-500 mt-2 text-center text-sm"
    >You have a beta version installed to test new features. <br />If you find a
    bug, please report it, or use a stable version.</span
  >
  <Transition
    name="slide-fade"
    enter-active-class="transition duration-500 ease-out"
    leave-active-class="transition duration-500 ease-in-out"
    enter-from-class="transform -translate-y-4 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-4 opacity-0"
    class="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-10"
  >
    <div
      v-if="installationStatus"
      class="mt-8 text-center text-sm font-medium text-gray-700 bg-gray-100 px-4 py-2 rounded-lg shadow-sm"
    >
      {{ installationStatus }}
    </div>
  </Transition>
  <ConfirmationModal
    :is-visible="isConfirmationVisible"
    title="Uninstallation"
    message="Are you sure you want to remove this extension?"
    @confirm="uninstallExtension"
    @cancel="isConfirmationVisible = false"
  />
</template>

<style scoped>
.progress-ring__circle {
  transform: rotate(-90deg); /* Это уже правильное значение для старта сверху */
  transform-origin: 50% 50%;
}
.jump-animation {
  animation: jump 0.6s cubic-bezier(0.25, 1, 0.5, 1.5);
}
@keyframes jump {
  0% {
    transform: scale(1);
  }
  20% {
    transform: scale(0.95);
  } /* Мини-подготовка перед прыжком */
  40% {
    transform: scale(1.8);
  } /* Максимальное увеличение */
  60% {
    transform: scale(1.6);
  } /* Откат назад */
  80% {
    transform: scale(1.9);
  } /* Второй мини-прыжок */
  100% {
    transform: scale(1.5);
  } /* Финал с небольшим увеличением */
}

.shadow-pulse {
  animation: shadowPulse 0.6s cubic-bezier(0.25, 1, 0.5, 1.5);
}
@keyframes shadowPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  40% {
    box-shadow: 0 0 0 20px rgba(59, 130, 246, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
  }
}
</style>
