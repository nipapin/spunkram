<script setup>
defineProps({
  isVisible: { type: Boolean, default: false },
  title: { type: String, default: 'Confirmation' },
  message: { type: String, default: 'Are you sure?' },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel: { type: String, default: 'Cancel' }
})

const emit = defineEmits(['confirm', 'cancel'])
const confirm = () => emit('confirm')
const cancel = () => emit('cancel')
</script>

<template>
  <Transition name="modal">
    <div
      v-if="isVisible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-black/70 backdrop-transition"
        style="backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px)"
        @click="cancel"
      ></div>

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
              background: rgba(239, 68, 68, 0.14);
              border: 1px solid rgba(239, 68, 68, 0.3);
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="w-4.5 h-4.5 text-red-400"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-base font-semibold text-white">{{ title }}</h3>
            <p
              class="mt-1.5 text-sm leading-relaxed"
              style="color: var(--color-text-muted)"
            >
              {{ message }}
            </p>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            class="modal-btn modal-btn-secondary"
            @click="cancel"
          >
            {{ cancelLabel }}
          </button>
          <button class="modal-btn modal-btn-danger" @click="confirm">
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
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

.modal-btn-danger {
  color: #ffffff;
  background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  border-color: rgba(239, 68, 68, 0.4);
  box-shadow: 0 6px 20px -8px rgba(239, 68, 68, 0.55);
}
.modal-btn-danger:hover {
  filter: brightness(1.08);
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
