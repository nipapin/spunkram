<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { URL_UPDATES_LOG } from '@common/constants'
defineProps({
  versions: {
    type: Object,
    required: true
  },
  latestVersion: {
    type: String,
    required: true
  },
  current: {
    type: String,
    required: true
  },
  checkLatest: {
    type: Boolean,
    required: true
  }
})

// Состояние для отображения выпадающего списка
const isDropdownOpen = ref(false)
const dropdownRef = ref(null)

const emit = defineEmits(['download-version', 'uninstall'])

// Функция для обработки действий
const handleVersionAction = (action) => {
  console.log(`Executing action: ${action}`)
  console.log(`Downloading software version: ${action}`)
  emit('download-version', action)
  // Закрываем выпадающий список после выбора
  isDropdownOpen.value = false
}

// Закрытие выпадающего списка при клике вне его
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    isDropdownOpen.value = false
  }
}

// Добавляем и удаляем обработчик клика при монтировании/размонтировании
onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <div
      class="flex items-center justify-between border-4 border-gray-600 rounded-full"
      :class="{
        'border-primary-600': !checkLatest,
        'border-gray-600': checkLatest
      }"
    >
      <!-- <div class="inline-block px-4 w-48 font-semibold text-gray-400">
        Version {{ current }}
      </div> -->
      <button
        class="flex items-center gap-1 w-48 font-semibold rounded-full text-left p-1 ml-1 px-2"
        :class="{
          'bg-primary-500 hover:bg-primary-600 text-white transition-colors duration-200':
            !checkLatest,
          ' text-gray-400 px-3': checkLatest
        }"
        :disabled="checkLatest"
        @click="handleVersionAction(latestVersion)"
      >
        <template v-if="!checkLatest">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-6 inline-block"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m9 12.75 3 3m0 0 3-3m-3 3v-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>

          Update to {{ latestVersion }}
        </template>
        <template v-else> Version {{ current }} </template>
      </button>

      <!-- Иконка для открытия выпадающего списка -->
      <button
        class="p-2 m-1 rounded-full bg-gray-600 hover:bg-gray-700 text-gray-300 transition-colors duration-200 focus:outline-none"
        @click="isDropdownOpen = !isDropdownOpen"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    <!-- Выпадающий список -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      leave-active-class="transition duration-150 ease-in"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="isDropdownOpen"
        class="absolute mt-2 w-72 rounded-md shadow-lg bg-gray-900 ring-1 ring-gray-700 z-50"
      >
        <div class="py-1 max-h-44 overflow-y-auto custom-scrollbar">
          <!-- Перебираем группы -->
          <div
            v-for="(group, groupName) in versions"
            :key="`group-${groupName}`"
            class="mb-2"
          >
            <!-- Заголовок группы -->
            <div
              class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800"
            >
              {{ groupName }} Releases
            </div>

            <!-- Элементы группы -->
            <div
              v-for="version in group"
              :key="version.name"
              class="px-4 py-3 hover:bg-gray-800 cursor-pointer transition-colors duration-150"
              @click="handleVersionAction(version.action)"
            >
              <div class="flex justify-between items-center">
                <div
                  class="flex items-center gap-2 text-sm font-medium text-gray-200"
                >
                  Version {{ version.name }}
                  <span
                    v-if="version.action == current"
                    class="inline-block size-1.5 align-middle rounded-full bg-primary-500"
                  ></span>
                  <span
                    v-else-if="version.action == versions.latestVersion"
                    class="bg-success-500 text-black font-bold uppercase text-[10px] align-top px-2 rounded-full"
                  >
                    Latest
                  </span>
                </div>
                <div class="text-xs text-gray-400">{{ version.date }}</div>
              </div>
              <!-- <div class="mt-2 flex items-center">
                <button
                  class="text-xs text-blue-400 hover:text-blue-300 transition-colors duration-150"
                >
                  Download
                </button>
              </div> -->
            </div>
          </div>
        </div>

        <!-- Футер выпадающего списка -->
        <div
          class="border-t border-gray-800 px-4 py-2 flex items-center justify-between"
        >
          <a
            :href="URL_UPDATES_LOG"
            target="_blank"
            class="block text-xs text-gray-400 hover:text-gray-300 transition-colors duration-150"
          >
            Open logs updates
          </a>
          <button
            target="_blank"
            class="flex items-center text-xs text-danger-500 font-semibold hover:text-gray-300 transition-colors duration-150"
            @click="emit('uninstall')"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
              />
            </svg>

            Uninstall
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
