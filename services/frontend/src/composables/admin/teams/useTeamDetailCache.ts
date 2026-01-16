import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { TeamService } from '@/services/teamService'
import type { Team } from '@/views/admin/teams/types'

export function useTeamDetailCache() {
  const route = useRoute()
  const { t } = useI18n()
  const eventBus = useEventBus()
  const { setBreadcrumbs } = useBreadcrumbs()

  const team = ref<Team | null>(null)
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  const teamId = route.params.id as string
  const storageKeyName = `admin_team_name_${teamId}`
  const storageKeyTeam = `admin_team_data_${teamId}`

  async function loadAndSetTeam() {
    try {
      isLoading.value = true
      const fetchedTeam = await TeamService.getTeamAsAdmin(teamId)

      team.value = fetchedTeam
      error.value = null

      // Cache the team name for instant loading on tab switches
      eventBus.setState(storageKeyName, fetchedTeam.name)

      // Cache the full team object for instant loading
      eventBus.setState(storageKeyTeam, fetchedTeam)

      // Update breadcrumbs with team name
      setBreadcrumbs([
        { label: t('adminTeams.title'), href: '/admin/teams' },
        { label: fetchedTeam.name }
      ])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An unknown error occurred'
      team.value = null

      // Clear cached data on error
      eventBus.clearState(storageKeyName)
      eventBus.clearState(storageKeyTeam)
    } finally {
      isLoading.value = false
    }
  }

  function initializeCache() {
    // Set initial breadcrumbs with loading state
    setBreadcrumbs([
      { label: t('adminTeams.title'), href: '/admin/teams' },
      { label: 'Loading...' }
    ])

    // Load cached team data immediately to prevent flicker
    const cachedName = eventBus.getState<string>(storageKeyName)
    const cachedTeam = eventBus.getState<Team>(storageKeyTeam)

    if (cachedTeam && !team.value) {
      team.value = cachedTeam
    } else if (cachedName && !team.value) {
      // At minimum, show cached name
      team.value = {
        name: cachedName
      } as Team
    }
  }

  function setupWatchers() {
    // Watch for team ID changes in route to clear cached data
    watch(
      () => route.params.id,
      (newId, oldId) => {
        if (newId && oldId && newId !== oldId) {
          // Clear old team's cached data
          const oldStorageKeyName = `admin_team_name_${oldId}`
          const oldStorageKeyTeam = `admin_team_data_${oldId}`
          eventBus.clearState(oldStorageKeyName)
          eventBus.clearState(oldStorageKeyTeam)

          // Reset team to null to trigger loading state
          team.value = null

          // Load new team
          loadAndSetTeam()
        }
      }
    )

    // Watch team value changes to update cache
    watch(
      () => team.value,
      (newTeam) => {
        if (newTeam) {
          eventBus.setState(storageKeyName, newTeam.name)
          eventBus.setState(storageKeyTeam, newTeam)
        }
      },
      { deep: true }
    )
  }

  function cleanupWatchers() {
    // No specific cleanup needed - Vue handles watch cleanup automatically
    // This function exists for API consistency with MCP pattern
  }

  return {
    team,
    isLoading,
    error,
    teamId,
    loadAndSetTeam,
    initializeCache,
    setupWatchers,
    cleanupWatchers
  }
}
