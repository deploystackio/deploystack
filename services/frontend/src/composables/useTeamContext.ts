import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { useEventBus } from './useEventBus'
import { TeamService, type Team } from '@/services/teamService'

interface UseTeamContextOptions {
  resourceCheck?: (teamId: string) => Promise<boolean>
}

interface UseTeamContextReturn {
  selectedTeam: Ref<Team | null>
  teamId: ComputedRef<string | null>
  teamRole: ComputedRef<'team_admin' | 'team_user' | null>
  isOwner: ComputedRef<boolean>
  isAdmin: ComputedRef<boolean>
  isDefaultTeam: ComputedRef<boolean>
  allowRemoteMcp: ComputedRef<boolean>
  allowGithubMcp: ComputedRef<boolean>
  allowPrivateGithubRepos: ComputedRef<boolean>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  hasTeam: ComputedRef<boolean>
  hasAccess: Ref<boolean>
}

/**
 * Composable for managing team context across pages
 *
 * Provides reactive team state, automatic event handling, and optional access control.
 *
 * Returns:
 * - `selectedTeam` - Full team object with all properties
 * - `teamId` - Computed shorthand for selectedTeam.value?.id
 * - `teamRole` - User's role in the team ('team_admin' | 'team_user')
 * - `isOwner` - True if user is the team owner
 * - `isAdmin` - True if user has team_admin role
 * - `isDefaultTeam` - True if this is the user's default team
 * - `allowRemoteMcp` - True if remote MCP servers are allowed for this team
 * - `allowGithubMcp` - True if GitHub MCP deployments are allowed for this team
 * - `allowPrivateGithubRepos` - True if private GitHub repositories are allowed
 * - `hasTeam` - True if a team is selected
 * - `isLoading` - Loading state during team operations
 * - `error` - Error message if team loading fails
 * - `hasAccess` - True if resource check passed (or no check provided)
 *
 * Basic usage (list pages):
 * ```typescript
 * const { selectedTeam, teamId, hasTeam, isAdmin } = useTeamContext()
 * ```
 *
 * Advanced usage (resource pages with access control):
 * ```typescript
 * const { selectedTeam, teamId, hasAccess, isOwner } = useTeamContext({
 *   resourceCheck: async (teamId: string) => {
 *     const resource = await service.getResource(teamId, resourceId)
 *     return resource !== null
 *   }
 * })
 * ```
 */
export function useTeamContext(options: UseTeamContextOptions = {}): UseTeamContextReturn {
  const eventBus = useEventBus()

  const selectedTeam = ref<Team | null>(null)
  const isLoading = ref<boolean>(true)
  const error = ref<string | null>(null)
  const hasAccess = ref<boolean>(true)

  const teamId = computed(() => selectedTeam.value?.id ?? null)
  const teamRole = computed(() => selectedTeam.value?.role ?? null)
  const isOwner = computed(() => selectedTeam.value?.is_owner === true)
  const isAdmin = computed(() => selectedTeam.value?.role === 'team_admin')
  const isDefaultTeam = computed(() => selectedTeam.value?.is_default === true)
  const allowRemoteMcp = computed(() => selectedTeam.value?.allow_remote_mcp === true)
  const allowGithubMcp = computed(() => selectedTeam.value?.allow_github_mcp === true)
  const allowPrivateGithubRepos = computed(() => selectedTeam.value?.allow_private_github_repos === true)
  const hasTeam = computed(() => selectedTeam.value !== null)

  /**
   * Initialize team context on mount
   * - Fetches user's teams
   * - Loads stored team from event bus storage
   * - Falls back to default team if stored team not found
   * - Validates access if resourceCheck provided
   */
  async function initializeTeam(): Promise<void> {
    try {
      isLoading.value = true
      error.value = null

      const teams = await TeamService.getUserTeams()

      if (teams.length === 0) {
        selectedTeam.value = null
        hasAccess.value = false
        return
      }

      const storedTeamId = eventBus.getState<string>('selected_team_id')

      let team: Team | null = null

      if (storedTeamId) {
        team = teams.find(t => t.id === storedTeamId) ?? null
      }

      if (!team) {
        const defaultTeam = teams.find(t => t.is_default)
        if (defaultTeam) {
          team = defaultTeam
        } else if (teams.length > 0 && teams[0]) {
          team = teams[0]
        }
        if (team) {
          eventBus.setState('selected_team_id', team.id)
        }
      }

      selectedTeam.value = team || null

      if (options.resourceCheck && team) {
        hasAccess.value = await options.resourceCheck(team.id)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load team'
      selectedTeam.value = null
      hasAccess.value = false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Handle team selection from sidebar
   * - Receives team-selected event from event bus
   * - Fetches full team object
   * - Validates access if resourceCheck provided
   * - Updates reactive state
   */
  async function handleTeamSelected(data: { teamId: string; teamName: string }): Promise<void> {
    try {
      isLoading.value = true
      error.value = null

      const teams = await TeamService.getUserTeams()
      const team = teams.find(t => t.id === data.teamId)

      if (!team) {
        error.value = 'Selected team not found'
        return
      }

      selectedTeam.value = team

      if (options.resourceCheck) {
        hasAccess.value = await options.resourceCheck(team.id)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to switch team'
    } finally {
      isLoading.value = false
    }
  }

  initializeTeam()

  eventBus.on('team-selected', handleTeamSelected)

  return {
    selectedTeam,
    teamId,
    teamRole,
    isOwner,
    isAdmin,
    isDefaultTeam,
    allowRemoteMcp,
    allowGithubMcp,
    allowPrivateGithubRepos,
    isLoading,
    error,
    hasTeam,
    hasAccess
  }
}
