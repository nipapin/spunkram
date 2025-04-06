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
</script>
<template>
  <!-- Круглая кнопка с прогресс-баром -->
  <div class="flex flex-col items-center my-8">
    <div
      class="relative"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <!-- Кнопка с интегрированным прогресс-баром -->
      <button
        class="progress-button size-20 rounded-full flex items-center justify-center transition-all duration-300"
        :class="{ hovered: isHovered, loading: isLoading }"
        :style="isLoading ? `--progress: ${downloadProgress}%` : ''"
        @click="installExtension"
      >
        <div
          class="inner-button size-20 shrink-0 rounded-full bg-blue-500 flex items-center justify-center shadow-lg"
        >
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
        </div>
      </button>

      <!-- Индикатор процента загрузки -->
    </div>

    <!-- Статус установки -->
    <div
      v-if="installationStatus"
      class="mt-8 text-center text-sm font-medium text-gray-700 bg-gray-100 px-4 py-2 rounded-lg"
    >
      {{ installationStatus }}
    </div>
  </div>
</template>

<style scoped>
/* Стили для кнопки с интегрированным прогресс-баром в виде обводки */
.progress-button {
  position: relative;
  background: transparent;
  --progress: 0%;
  padding: 70px;
}

.progress-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  /* Улучшаем гладкость обводки */
  mask: radial-gradient(
    transparent calc(50% - 3px),
    #000 calc(50% - 3px),
    #000 calc(50% - 1px),
    transparent calc(50% - 1px)
  );
  -webkit-mask: radial-gradient(
    transparent calc(50% - 3px),
    #000 calc(50% - 3px),
    #000 calc(50% - 1px),
    transparent calc(50% - 1px)
  );
  background: conic-gradient(#3b82f6 var(--progress), #e5e7eb var(--progress));
  opacity: 1;
  transition: opacity 0.3s;
  /* Добавляем сглаживание */
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: transform;
}

.progress-button.loading::before {
  opacity: 1;
}

.progress-button.hovered .inner-button {
  background-color: #2563eb; /* bg-blue-600 */
  transform: scale(1.05);
}

.progress-button.loading .inner-button {
  opacity: 0.8;
}

.inner-button {
  position: relative;
  z-index: 1;
  transition: all 0.3s;
}
</style>
