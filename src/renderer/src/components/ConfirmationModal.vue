<template>
  <Transition name="modal">
    <div
      v-if="isVisible"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <!-- Затемнённый фон -->
      <div
        class="absolute inset-0 bg-black bg-opacity-60 backdrop-transition"
        @click="cancel"
      ></div>

      <!-- Модальное окно -->
      <div
        class="relative backdrop-blur-sm rounded-lg shadow-xl p-6 max-w-md w-full m-4 content-transition border border-gray-700"
      >
        <!-- Заголовок -->
        <div class="text-center mb-4">
          <h3 class="text-lg font-medium text-white">
            {{ title }}
          </h3>
        </div>

        <!-- Содержимое -->
        <div class="mt-2">
          <p class="text-sm text-gray-300 text-center">
            {{ message }}
          </p>
        </div>

        <!-- Кнопки - центрированные в стиле Adobe -->
        <div class="mt-6 flex justify-center space-x-4">
          <button
            class="flex items-center gap-1 shrink-0 font-semibold rounded-full p-2 px-6 bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors duration-200 focus:outline-none"
            @click="cancel"
          >
            No
          </button>
          <button
            class="flex items-center gap-1 shrink-0 font-semibold rounded-full p-2 px-6 bg-danger-500 hover:bg-danger-600 text-white transition-colors duration-200 focus:outline-none"
            @click="confirm"
          >
            I confirm
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Confirmation'
  },
  message: {
    type: String,
    default: 'Are you sure?'
  }
})

const emit = defineEmits(['confirm', 'cancel'])

const confirm = () => {
  emit('confirm')
}

const cancel = () => {
  emit('cancel')
}
</script>

<style scoped>
/* Анимация для всего модального окна */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Добавляем анимацию для содержимого через классы */
.content-transition {
  transition: all 0.3s ease;
}

.modal-enter-from .content-transition,
.modal-leave-to .content-transition {
  opacity: 0;
  transform: scale(0.9);
}

/* Анимация для фона */
.backdrop-transition {
  transition: opacity 0.3s ease;
}

.modal-enter-from .backdrop-transition,
.modal-leave-to .backdrop-transition {
  opacity: 0;
}

/* Стилизация скроллбара в стиле Adobe */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #2d2d2d;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #5a5a5a;
}
</style>
