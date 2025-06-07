// @/i18n/locales/en/index.ts
import commonMessages from './common'
import authMessages from './auth'
import setupMessages from './setup'
import dashboardMessages from './dashboard'
import globalSettingsMessages from './globalSettings'
import notFoundMessages from './notFound'
import adminUsersMessages from './adminUsers'
import sidebarMessages from './sidebar'
import verifyEmailMessages from './verifyEmail'
import forgotPasswordMessages from './forgotPassword'
import resetPasswordMessages from './resetPassword'

export default {
  ...commonMessages,
  ...authMessages,
  ...setupMessages,
  ...dashboardMessages,
  ...globalSettingsMessages,
  ...notFoundMessages,
  ...adminUsersMessages,
  ...sidebarMessages,
  ...verifyEmailMessages,
  ...forgotPasswordMessages,
  ...resetPasswordMessages,
  // If there are any top-level keys directly under 'en', they can be added here.
  // For example, if you had a global 'appName': 'My Application'
  // appName: 'DeployStack Application',
}
