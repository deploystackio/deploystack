import { createI18n } from 'vue-i18n'
// Import the merged English messages from the new structure
import enMessages from './locales/en' // This will now import from locales/en/index.ts

// Create i18n instance with English as the default language
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: enMessages, // Use the merged messages directly
  },
})

export default i18n
