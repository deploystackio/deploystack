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
import teamsMessages from './teams'
import credentialsMessages from './credentials'
import mcpCatalogMessages from './mcp-catalog'
import mcpCategoriesMessages from './mcp-categories'
import mcpInstallationsMessages from './mcp-installations'

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
  ...teamsMessages,
  ...credentialsMessages,
  ...mcpCategoriesMessages,
  mcpCatalog: mcpCatalogMessages,
  mcpInstallations: mcpInstallationsMessages,
  // If there are any top-level keys directly under 'en', they can be added here.
  // For example, if you had a global 'appName': 'My Application'
  // appName: 'DeployStack Application',
}
