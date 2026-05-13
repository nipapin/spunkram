<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale, SupportedLocale, SUPPORTED_LOCALES } from '../i18n'

const { locale } = useI18n()

const items: { code: SupportedLocale; short: string }[] = [
  { code: 'en', short: 'EN' },
  { code: 'tr', short: 'TR' }
]

const current = computed(() => locale.value as SupportedLocale)

const selectLocale = (code: SupportedLocale): void => {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(code)) return
  setLocale(code)
}
</script>

<template>
  <div class="lang-switcher" role="group" :aria-label="$t('language.label')">
    <button
      v-for="item in items"
      :key="item.code"
      type="button"
      class="lang-pill"
      :class="{ 'is-active': current === item.code }"
      :aria-pressed="current === item.code"
      :title="$t(`language.${item.code}`)"
      @click="selectLocale(item.code)"
    >
      {{ item.short }}
    </button>
  </div>
</template>

<style scoped>
.lang-switcher {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  gap: 2px;
}

.lang-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 24px;
  padding: 0 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.lang-pill:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.05);
}
.lang-pill.is-active {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}
</style>
