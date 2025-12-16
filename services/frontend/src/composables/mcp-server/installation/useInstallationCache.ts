import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useEventBus } from './useEventBus'
import { useBreadcrumbs } from './useBreadcrumbs'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService, type Team } from '@/services/teamService'
import type { McpInstallation } from '@/types/mcp-installations'

interface InstallationLoadResult {
  team: Team
  installation: McpInstallation
  userRole: 'team_admin' | 'team_user'
}

export function useMcpInstallationCache() {
  const route = useRoute()
  const { t } = useI18n()
  const eventBus = useEventBus()
  const { setBreadcrumbs } = useBreadcrumbs()

  const installation = ref<McpInstallation | null>(null)
  const currentTeam = ref<Team | null>(null)
  const userTeamRole = ref<'team_admin' | 'team_user' | null>(null)
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  const installationId = route.params.id as string
  const storageKey = `mcp_installation_name_${installationId}`

  async function loadInstallation(installationId: string): Promise<InstallationLoadResult | null> {
    try {
      const selectedTeamId = eventBus.getState<string>('selected_team_id')

      if (!selectedTeamId) {
        const userTeams = await TeamService.getUserTeams()

        for (const team of userTeams) {
          try {
            const installation = await McpInstallationService.getInstallationById(team.id, installationId)
            if (installation) {
              eventBus.setState('selected_team_id', team.id)
              return {
                team,
                installation,
                userRole: team.role || 'team_user'
              }
            }
          } catch {
            continue
          }
        }

        return null
      }

      const userTeams = await TeamService.getUserTeams()
      const selectedTeam = userTeams.find(team => team.id === selectedTeamId)

      if (!selectedTeam) {
        return null
      }

      const installation = await McpInstallationService.getInstallationById(selectedTeam.id, installationId)

      if (!installation) {
        return null
      }

      return {
        team: selectedTeam,
        installation,
        userRole: selectedTeam.role || 'team_user'
      }
    } catch {
      return null
    }
  }

  async function loadAndSetInstallation() {
    try {
      isLoading.value = true
      const result = await loadInstallation(installationId)

      if (result) {
        installation.value = result.installation
        currentTeam.value = result.team
        userTeamRole.value = result.userRole
        error.value = null

        // Cache the installation name for instant loading on tab switches
        eventBus.setState(storageKey, result.installation.installation_name)

        setBreadcrumbs([
          { label: t('mcpInstallations.title'), href: '/mcp-server' },
          { label: result.installation.installation_name }
        ])
      } else {
        error.value = 'Installation not found in the selected team or no team selected'
        installation.value = null
        currentTeam.value = null
        userTeamRole.value = null

        // Clear cached name if installation not found
        eventBus.clearState(storageKey)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An unknown error occurred'
      installation.value = null
      currentTeam.value = null
      userTeamRole.value = null

      // Clear cached name on error
      eventBus.clearState(storageKey)
    } finally {
      isLoading.value = false
    }
  }

  function initializeCache() {
    setBreadcrumbs([
      { label: t('mcpInstallations.title'), href: '/mcp-server' },
      { label: 'Loading...' }
    ])

    // Load cached installation name immediately to prevent flicker
    const cachedName = eventBus.getState<string>(storageKey)
    if (cachedName && !installation.value) {
      installation.value = { installation_name: cachedName } as McpInstallation
    }
  }

  function setupWatchers(onTeamChanged?: () => Promise<void>) {
    // Watch for installation ID changes to clear cached name
    watch(
      () => route.params.id,
      (newId, oldId) => {
        if (newId && oldId && newId !== oldId) {
          // Clear old installation's cached name
          const oldStorageKey = `mcp_installation_name_${oldId}`
          eventBus.clearState(oldStorageKey)

          // Reset installation to null to trigger loading state
          installation.value = null

          // Load new installation
          loadAndSetInstallation()
        }
      }
    )

    // Listen for team changes from event bus
    eventBus.on('storage-changed', (data) => {
      if (data.key === 'selected_team_id') {
        if (onTeamChanged) {
          onTeamChanged()
        } else {
          loadAndSetInstallation()
        }
      }
    })
  }

  function cleanupWatchers(onTeamChanged?: () => Promise<void>) {
    const handler = onTeamChanged || loadAndSetInstallation
    eventBus.off('storage-changed', handler)
  }

  return {
    installation,
    currentTeam,
    userTeamRole,
    isLoading,
    error,
    installationId,
    loadAndSetInstallation,
    initializeCache,
    setupWatchers,
    cleanupWatchers
  }
}
