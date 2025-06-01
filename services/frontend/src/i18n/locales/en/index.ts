// @/i18n/locales/en/index.ts
import commonMessages from './common'
import authMessages from './auth'
import setupMessages from './setup'
import dashboardMessages from './dashboard'
import globalSettingsMessages from './globalSettings'
import notFoundMessages from './notFound'

export default {
  ...commonMessages,
  ...authMessages,
  ...setupMessages,
  ...dashboardMessages,
  ...globalSettingsMessages,
  ...notFoundMessages,
  // If there are any top-level keys directly under 'en', they can be added here.
  // For example, if you had a global 'appName': 'My Application'
  // appName: 'DeployStack Application',
}
