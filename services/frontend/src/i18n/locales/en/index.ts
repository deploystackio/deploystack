// @/i18n/locales/en/index.ts
import commonMessages from './common'
import authMessages from './auth'
import setupMessages from './setup'

export default {
  ...commonMessages,
  ...authMessages,
  ...setupMessages,
  // If there are any top-level keys directly under 'en', they can be added here.
  // For example, if you had a global 'appName': 'My Application'
  // appName: 'DeployStack Application',
}
