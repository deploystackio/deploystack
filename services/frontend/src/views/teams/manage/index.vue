<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { TeamService } from '@/services/teamService'
import { useEventBus } from '@/composables/useEventBus'

const router = useRouter()
const eventBus = useEventBus()

onMounted(async () => {
  try {
    // First, check if there's a selected team in the current context
    const selectedTeamId = eventBus.getState<string>('selected_team_id')
    
    if (selectedTeamId) {
      // Validate that the selected team still exists and user has access
      try {
        const userTeams = await TeamService.getUserTeams()
        const selectedTeam = userTeams.find(team => team.id === selectedTeamId)
        
        if (selectedTeam) {
          // Redirect to the currently selected team's manage page
          router.replace(`/teams/manage/${selectedTeamId}`)
          return
        }
        // If selected team is not found, clear it from storage and continue to default
        eventBus.clearState('selected_team_id')
      } catch (error) {
        console.warn('Error validating selected team, falling back to default:', error)
        eventBus.clearState('selected_team_id')
      }
    }
    
    // Fallback: use the default team
    const defaultTeam = await TeamService.getUserDefaultTeam()
    if (defaultTeam) {
      // Update the selected team context to the default team
      eventBus.setState('selected_team_id', defaultTeam.id)
      router.replace(`/teams/manage/${defaultTeam.id}`)
    } else {
      // Fallback: redirect to teams list if no default team found
      router.replace('/teams')
    }
  } catch (error) {
    console.error('Error fetching team for management:', error)
    // Fallback: redirect to teams list on error
    router.replace('/teams')
  }
})
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      <p class="mt-2 text-gray-600">Redirecting to team management...</p>
    </div>
  </div>
</template>
