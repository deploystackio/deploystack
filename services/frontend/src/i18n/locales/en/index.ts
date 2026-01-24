// @/i18n/locales/en/index.ts
import commonMessages from './common'
import authMessages from './auth'
import setupMessages from './setup'
import dashboardMessages from './dashboard'
import globalSettingsMessages from './globalSettings'
import notFoundMessages from './notFound'
import unauthorizedMessages from './unauthorized'
import adminUsersMessages from './adminUsers'
import adminTeamsMessages from './adminTeams'
import sidebarMessages from './sidebar'
import verifyEmailMessages from './verifyEmail'
import forgotPasswordMessages from './forgotPassword'
import resetPasswordMessages from './resetPassword'
import teamsMessages from './teams'
import credentialsMessages from './credentials'
import mcpCatalogMessages from './mcp-catalog'
import mcpCategoriesMessages from './mcp-categories'
import mcpInstallationsMessages from './mcp-installations'
import mcpServerMessages from './mcp-server'
import oauthMessages from './oauth'
import registerMessages from './register'
import loginMessages from './login'
import satelliteConfigMessages from './satelliteConfig'
import satellitesMessages from './satellites'
import userAccountMessages from './userAccount'
import clientConfigurationMessages from './clientConfiguration'
import statisticsMessages from './statistics'
import deploymentsMessages from './deployments'

import walkthroughMessages from './walkthrough'

export default {
  ...commonMessages,
  ...authMessages,
  ...setupMessages,
  ...dashboardMessages,
  ...globalSettingsMessages,
  ...notFoundMessages,
  ...unauthorizedMessages,
  ...adminUsersMessages,
  ...adminTeamsMessages,
  ...sidebarMessages,
  verifyEmail: verifyEmailMessages,
  ...forgotPasswordMessages,
  ...resetPasswordMessages,
  ...teamsMessages,
  ...credentialsMessages,
  ...mcpCategoriesMessages,
  mcpCatalog: mcpCatalogMessages,
  mcpInstallations: mcpInstallationsMessages,
  mcpServer: mcpServerMessages,
  oauth: oauthMessages,
  register: registerMessages,
  login: loginMessages,
  satelliteConfig: satelliteConfigMessages,
  satellites: satellitesMessages,
  userAccount: userAccountMessages,
  clientConfiguration: clientConfigurationMessages,
  statistics: statisticsMessages,
  ...deploymentsMessages,
  walkthrough: walkthroughMessages,
  common: commonMessages
}
