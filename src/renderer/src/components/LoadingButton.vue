<template>
  <button
    class="relative inline-flex items-center justify-center p-4 overflow-hidden font-medium transition duration-300 ease-out rounded-full shadow-md"
    :class="[
      isLoading
        ? 'text-transparent cursor-wait'
        : 'text-indigo-600 hover:shadow-lg',
      bgClasses
    ]"
    :disabled="isLoading"
    @click="handleClick"
  >
    <!-- Текст кнопки -->
    <span class="relative z-10">
      <slot v-if="!isLoading" />
      <span v-else>Загрузка...</span>
    </span>

    <!-- Фон кнопки -->
    <span class="absolute inset-0 rounded-full" :class="bgClasses"></span>

    <!-- Border-индикатор загрузки -->
    <span
      v-if="isLoading"
      class="absolute inset-[-2px] rounded-full border-2 border-transparent"
      :style="borderStyle"
    ></span>
  </button>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false
  },
  progress: {
    type: Number,
    default: 0,
    validator: (value) => value >= 0 && value <= 100
  },
  bgClasses: {
    type: String,
    default: 'bg-gradient-to-br from-indigo-100 via-indigo-200 to-indigo-300'
  },
  borderColor: {
    type: String,
    default: 'indigo-500'
  }
})

const emit = defineEmits(['click'])

const borderStyle = computed(() => {
  if (props.isLoading) {
    if (props.progress > 0) {
      // Режим прогресса (0-100%)
      return {
        background: `conic-gradient(from 0deg, transparent 0%, transparent ${360 - props.progress * 3.6}deg, var(--tw-${props.borderColor}) ${360 - props.progress * 3.6}deg, var(--tw-${props.borderColor}) 360deg)`,
        mask: 'linear-gradient(white, white) content-box, linear-gradient(white, white)',
        maskComposite: 'exclude',
        padding: '2px'
      }
    } else {
      // Режим бесконечной анимации
      return {
        borderColor: `transparent transparent transparent var(--tw-${props.borderColor})`,
        animation: 'spin 1s linear infinite'
      }
    }
  }
  return {}
})

const handleClick = (e) => {
  if (!props.isLoading) {
    emit('click', e)
  }
}
</script>

<style>
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
