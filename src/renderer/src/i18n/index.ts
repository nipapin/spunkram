import { createI18n } from 'vue-i18n'
import en from './locales/en'
import tr from './locales/tr'

export const SUPPORTED_LOCALES = ['en', 'tr'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

const STORAGE_KEY = 'spunkram.locale'

function detectInitialLocale(): SupportedLocale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) {
      return saved as SupportedLocale
    }
  } catch {
    // localStorage недоступен — пойдём дефолтом
  }
  const navLang = (navigator.language || 'en').toLowerCase()
  if (navLang.startsWith('tr')) return 'tr'
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  messages: { en, tr }
})

export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // ignore
  }
  document.documentElement.lang = locale
}

// При первой загрузке тоже синхронизируем <html lang="...">
document.documentElement.lang = i18n.global.locale.value
