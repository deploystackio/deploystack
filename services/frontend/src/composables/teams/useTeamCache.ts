import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { TeamService, type Team } from '@/services/teamService'

export function useTeamCache() {
  const route = useRoute()
  const { t } = useI18n()
  const eventBus = useEventBus()
  const { setBreadcrumbs } = useBreadcrumbs()

  const team = ref<Team | null>(null)
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  const teamId = route.params.id as string
  const storageKeyName = `team_name_${teamId}`
  const storageKeySlug = `team_slug_${teamId}`

  async function loadAndSetTeam() {
    try {
      isLoading.value = true
      const fetchedTeam = await TeamService.getTeamById(teamId)

      team.value = fetchedTeam
      error.value = null

      // Cache the team name and slug for instant loading on tab switches
      eventBus.setState(storageKeyName, fetchedTeam.name)
      eventBus.setState(storageKeySlug, fetchedTeam.slug)

      // Update breadcrumbs with team name
      setBreadcrumbs([
        { label: t('teams.title'), href: '/teams' },
        { label: fetchedTeam.name }
      ])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load team'
      team.value = null

      // Clear cached data on error
      eventBus.clearState(storageKeyName)
      eventBus.clearState(storageKeySlug)
    } finally {
      isLoading.value = false
    }
  }

  function initializeCache() {
    // Set initial breadcrumbs with loading state
    setBreadcrumbs([
      { label: t('teams.title'), href: '/teams' },
      { label: t('teams.manage.loading') }
    ])

    // Load cached team data immediately to prevent flicker
    const cachedName = eventBus.getState<string>(storageKeyName)
    const cachedSlug = eventBus.getState<string>(storageKeySlug)

    if (cachedName && !team.value) {
      team.value = {
        name: cachedName,
        slug: cachedSlug
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
          const oldStorageKeyName = `team_name_${oldId}`
          const oldStorageKeySlug = `team_slug_${oldId}`
          eventBus.clearState(oldStorageKeyName)
          eventBus.clearState(oldStorageKeySlug)

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
          eventBus.setState(storageKeySlug, newTeam.slug)
        }
      },
      { deep: true }
    )
  }

  function cleanupWatchers() {
    // No specific cleanup needed - Vue handles watch cleanup automatically
    // This function exists for API consistency
  }

  function handleTeamUpdated(updatedTeam: Team) {
    // Merge updated team data while preserving permission fields
    if (team.value) {
      team.value = {
        ...team.value,
        ...updatedTeam,
        // Explicitly preserve permission fields if they're not in the update response
        role: updatedTeam.role ?? team.value.role,
        is_admin: updatedTeam.is_admin ?? team.value.is_admin,
        is_owner: updatedTeam.is_owner ?? team.value.is_owner,
        member_count: updatedTeam.member_count ?? team.value.member_count,
      }
    } else {
      team.value = updatedTeam
    }
  }

  return {
    team,
    isLoading,
    error,
    teamId,
    loadAndSetTeam,
    initializeCache,
    setupWatchers,
    cleanupWatchers,
    handleTeamUpdated
  }
}
