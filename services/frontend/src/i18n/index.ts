import { createI18n } from 'vue-i18n'
import en from './locales/en'

// Create i18n instance with English as the default language
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
  },
})

export default i18n
