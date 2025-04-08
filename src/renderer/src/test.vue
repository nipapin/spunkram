<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'

const isHovered = ref(false)

const isLoading = ref(false)
const downloadProgress = ref(0)
const installationStatus = ref('')
// Добавляем правильное объявление переменной
let progressUnsubscribe: (() => void) | null = null

// Очищаем подписки при размонтировании компонента
onBeforeUnmount(() => {
  if (progressUnsubscribe) {
    progressUnsubscribe()
  }
})

// Создаем вычисляемое свойство для стилей прогресс-бара
const progressStyle = computed(() => {
  const progress = downloadProgress.value
  // Используем conic-gradient для создания кругового прогресс-бара
  return {
    background: `conic-gradient(red ${progress}%, transparent ${progress}%)`
  }
})

const testInstall = () => {
  isLoading.value = true

  const l = setInterval(() => {
    if (downloadProgress.value < 100) {
      downloadProgress.value++
    } else {
      isLoading.value = false
      setTimeout(() => {
        installationStatus.value = 'Расширение успешно установлено!'

        downloadProgress.value = 0

        clearInterval(l)
      }, 500)
    }
  }, 25)
}

const installExtension = async () => {
  if (isLoading.value) return

  isLoading.value = true
  downloadProgress.value = 0
  installationStatus.value = 'Загрузка расширения...'

  try {
    // URL к ZXP файлу
    const url = 'https://api.get-atomx.com/atomx_files/zxp/atomx_3.1.1r5.zxp'
    const extensionName = 'MyAdobeExtension'

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
        console.log('Получено обновление прогресса:', progress)
        if (typeof progress === 'number') {
          downloadProgress.value = progress
        }
      })

      // Подписываемся на завершение установки
      window.api.onInstallationComplete((result) => {
        console.log('Получен результат установки:', result)

        if (result && result.success) {
          installationStatus.value = 'Расширение успешно установлено!'
        } else {
          installationStatus.value = `Ошибка: ${result && result.error ? result.error : 'Неизвестная ошибка'}`
        }

        setTimeout(() => {
          isLoading.value = false
          downloadProgress.value = 0
          installationStatus.value = ''
        }, 3000)
      })

      // Отправляем запрос на загрузку и установку
      console.log('Отправляем запрос на загрузку:', url, extensionName)
      window.api.downloadExtension(url, extensionName)
    } else {
      console.error('electron недоступен')
      installationStatus.value = 'Ошибка: API Electron недоступен'

      setTimeout(() => {
        isLoading.value = false
        downloadProgress.value = 0
        installationStatus.value = ''
      }, 3000)
    }
  } catch (error) {
    console.error('Ошибка:', error)
    installationStatus.value = `Ошибка: ${error.message || 'Неизвестная ошибка'}`

    setTimeout(() => {
      isLoading.value = false
      downloadProgress.value = 0
      installationStatus.value = ''
    }, 3000)
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
  <div class="relative size-28 flex items-center justify-center">
    <!-- Фоновый круг -->
    <!-- <svg class="absolute w-full h-full" viewBox="0 0 100 100">

    </svg> -->

    <!-- Прогресс -->
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

    <!-- Текст прогресса -->
    <button
      class="inset-0 z-10 flex items-center justify-center size-20 shrink-0 rounded-full bg-blue-500 hover:scale-105 hover:bg-blue-600 transition-all duration-300"
      :class="{
        'pointer-events-none': isLoading,
        'jump-animation shadow-pulse': downloadProgress === 100,
        'scale-110 bg-green-500': downloadProgress === 100 && !isLoading
      }"
      @click="testInstall"
    >
      <!-- <div
        class="inner-button size-20 shrink-0 rounded-full bg-blue-500 flex items-center justify-center shadow-lg"
      >

      </div> -->
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

  <div
    v-if="installationStatus"
    class="mt-8 text-center text-sm font-medium text-gray-700 bg-gray-100 px-4 py-2 rounded-lg"
  >
    {{ installationStatus }}
  </div>
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
