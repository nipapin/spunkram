<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const groupLabel = (groupName) => {
  if (groupName === 'stable') return t('versions.groupStable')
  if (groupName === 'beta') return t('versions.groupBeta')
  return groupName
}

const props = defineProps({
  versions: { type: Object, required: true },
  latestVersion: { type: String, required: true },
  current: { type: String, required: true },
  group: { type: String, required: false, default: 'stable' },
  variant: {
    type: String,
    default: 'compact',
    validator: (v) => ['compact'].includes(v)
  }
})

const isOpen = ref(false)
const dropdownRef = ref(null)
const triggerRef = ref(null)
const placement = ref('bottom') // 'bottom' | 'top'
const maxScrollHeight = ref(240)

const emit = defineEmits(['download-version'])

const SAFE_MARGIN = 16
const HEADER_HEIGHT = 38

const computePlacement = () => {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const viewportH = window.innerHeight
  const spaceBelow = viewportH - rect.bottom - SAFE_MARGIN
  const spaceAbove = rect.top - SAFE_MARGIN

  // Pick the side with more room
  if (spaceBelow >= spaceAbove) {
    placement.value = 'bottom'
    maxScrollHeight.value = Math.max(
      120,
      Math.min(280, spaceBelow - HEADER_HEIGHT - 16)
    )
  } else {
    placement.value = 'top'
    maxScrollHeight.value = Math.max(
      120,
      Math.min(280, spaceAbove - HEADER_HEIGHT - 16)
    )
  }
}

const toggleOpen = async () => {
  if (!isOpen.value) {
    computePlacement()
  }
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    computePlacement()
  }
}

const handleSelect = (action, groupName) => {
  if (action === props.current && groupName === props.group) {
    isOpen.value = false
    return
  }
  emit('download-version', action, groupName)
  isOpen.value = false
}

const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    isOpen.value = false
  }
}

const handleResize = () => {
  if (isOpen.value) computePlacement()
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  window.addEventListener('resize', handleResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  window.removeEventListener('resize', handleResize)
})

const totalVersions = computed(() => {
  const stable = props.versions?.stable?.length ?? 0
  const beta = props.versions?.beta?.length ?? 0
  return stable + beta
})
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <button
      ref="triggerRef"
      class="version-trigger"
      :class="{ 'is-open': isOpen }"
      :title="$t('versions.chooseVersionTitle', { count: totalVersions })"
      @click="toggleOpen"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="w-4 h-4 opacity-70"
      >
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    </button>

    <Transition
      :enter-active-class="
        placement === 'top'
          ? 'transition duration-200 ease-out'
          : 'transition duration-200 ease-out'
      "
      leave-active-class="transition duration-150 ease-in"
      :enter-from-class="
        placement === 'top'
          ? 'transform scale-95 opacity-0 translate-y-1'
          : 'transform scale-95 opacity-0 -translate-y-1'
      "
      enter-to-class="transform scale-100 opacity-100 translate-y-0"
      leave-from-class="transform scale-100 opacity-100 translate-y-0"
      :leave-to-class="
        placement === 'top'
          ? 'transform scale-95 opacity-0 translate-y-1'
          : 'transform scale-95 opacity-0 -translate-y-1'
      "
    >
      <div
        v-if="isOpen"
        class="dropdown-panel"
        :class="`placement-${placement}`"
        :style="{
          transformOrigin: placement === 'top' ? 'bottom right' : 'top right'
        }"
      >
        <div class="dropdown-header">
          <span>{{ $t('versions.available') }}</span>
          <span class="text-[10px] opacity-60">{{
            $t('versions.total', { count: totalVersions })
          }}</span>
        </div>

        <div
          class="dropdown-scroll custom-scrollbar"
          :style="{ maxHeight: `${maxScrollHeight}px` }"
        >
          <template
            v-for="(group, groupName) in versions"
            :key="`group-${groupName}`"
          >
            <div
              v-if="Array.isArray(group) && group.length"
              class="dropdown-group-label"
            >
              {{ groupLabel(groupName) }}
            </div>
            <button
              v-for="version in group"
              :key="`${groupName}-${version.name}`"
              class="dropdown-item"
              :class="{
                'is-current':
                  version.action === current && groupName === props.group
              }"
              @click="handleSelect(version.action, groupName)"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-mono text-[13px] text-white truncate">
                  v{{ version.name }}
                </span>
                <span
                  v-if="
                    version.action === latestVersion && groupName === 'stable'
                  "
                  class="badge-latest"
                >
                  {{ $t('badge.latest') }}
                </span>
                <span v-else-if="groupName === 'beta'" class="badge-beta">
                  {{ $t('badge.beta') }}
                </span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span
                  v-if="version.date"
                  class="text-[11px]"
                  style="color: var(--color-text-dim)"
                >
                  {{ version.date }}
                </span>
                <span
                  v-if="version.action === current && groupName === props.group"
                  class="check-mark"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="w-3 h-3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </div>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.version-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition:
    background 0.2s,
    border-color 0.2s;
  cursor: pointer;
  flex-shrink: 0;
}
.version-trigger:hover,
.version-trigger.is-open {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.18);
}

.dropdown-panel {
  position: absolute;
  right: 0;
  width: 280px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(17, 17, 28, 0.96);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow:
    0 24px 60px -20px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.02);
  z-index: 50;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dropdown-panel.placement-bottom {
  top: calc(100% + 8px);
}
.dropdown-panel.placement-top {
  bottom: calc(100% + 8px);
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
}

.dropdown-scroll {
  overflow-y: auto;
  padding: 6px;
  flex: 1 1 auto;
  min-height: 0;
}

.dropdown-group-label {
  padding: 8px 10px 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-dim);
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 9px 10px;
  border-radius: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
  color: var(--color-text);
}
.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.05);
}
.dropdown-item.is-current {
  background: rgba(124, 58, 237, 0.12);
}

.badge-latest {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.16);
  color: #34d399;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge-beta {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.16);
  color: #fbbf24;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.check-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--grad-primary);
  color: white;
}
</style>
