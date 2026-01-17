import { registerSettingsComponent, getAllRegisteredComponents } from '@/composables/useSettingsComponentRegistry'
import GitHubAppSettings from './GitHubAppSettings.vue'
import SmtpSettings from './SmtpSettings.vue'
import TeamSettings from './TeamSettings.vue'

/**
 * Register all custom settings components
 * This function should be called during app initialization
 */
export function registerSettingsComponents() {
  // Register GitHub App Settings Component
  registerSettingsComponent('github-app', {
    component: GitHubAppSettings,
    description: 'Custom GitHub App configuration component with connection testing',
    author: 'DeployStack Team',
    version: '1.0.0'
  })

  // Register SMTP Settings Component
  registerSettingsComponent('smtp', {
    component: SmtpSettings,
    description: 'SMTP configuration with email testing',
    author: 'DeployStack Team',
    version: '1.0.0'
  })

  // Register Team Settings Component
  registerSettingsComponent('team', {
    component: TeamSettings,
    description: 'Team management and limit configuration',
    author: 'DeployStack Team',
    version: '1.0.0'
  })
}

/**
 * Get information about all registered components
 */
export function getRegisteredComponentsInfo() {
  const components = getAllRegisteredComponents()

  const info: Array<{
    groupId: string
    description: string
    author: string
    version: string
  }> = []

  components.forEach((definition, groupId) => {
    info.push({
      groupId,
      description: definition.description || 'No description available',
      author: definition.author || 'Unknown',
      version: definition.version || '1.0.0'
    })
  })

  return info
}
