<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Skeleton } from '@/components/ui/skeleton'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { TeamManageHeader, TeamManageTabs, TeamInfo } from '@/components/teams/manage'
import { useTeamCache } from '@/composables/teams/useTeamCache'
import { useEventBus } from '@/composables/useEventBus'

const route = useRoute()
const router = useRouter()
const eventBus = useEventBus()

const {
  team,
  isLoading,
  error,
  teamId,
  loadAndSetTeam,
  initializeCache,
  setupWatchers,
  cleanupWatchers,
  handleTeamUpdated
} = useTeamCache()

// Computed permissions
const canEditName = computed(() => {
  return team.value?.is_admin === true &&
         !team.value?.is_default
})

const canEditDescription = computed(() => {
  return team.value?.is_admin === true
})

const canDeleteTeam = computed(() => {
  return team.value?.is_owner === true &&
         !team.value?.is_default
})

// Handle team selection from sidebar
const handleTeamSelected = (data: { teamId: string; teamName: string }) => {
  // If we're switching to a different team, navigate to that team's manage page
  if (data.teamId !== teamId) {
    // Preserve the current section (general)
    router.push(`/teams/manage/${data.teamId}/general`)
  }
}

// Load team on component mount
onMounted(async () => {
  initializeCache()
  await loadAndSetTeam()
  setupWatchers()

  // Check for success query parameter
  if (route.query.updated === 'true') {
    toast.success('Team updated successfully')
    router.replace({ query: {} })
  }

  // Listen for team selection events from sidebar
  eventBus.on('team-selected', handleTeamSelected)
})

onUnmounted(() => {
  cleanupWatchers()
  eventBus.off('team-selected', handleTeamSelected)
})
</script>

<template>
  <NavbarLayout>
    <TeamManageHeader :team="team" :is-loading="isLoading" />

    <div class="space-y-6 mt-6">
      <!-- Tabs - Always visible when team is loaded -->
      <TeamManageTabs v-if="team" :team="team" :team-id="teamId">
        <!-- Error State -->
        <div v-if="error" class="text-red-500">
          {{ error }}
        </div>

        <!-- Loading State for Content -->
        <div v-else-if="isLoading" class="space-y-4">
          <Skeleton class="h-32 w-full rounded-lg" />
          <Skeleton class="h-32 w-full rounded-lg" />
          <Skeleton class="h-32 w-full rounded-lg" />
        </div>

        <!-- Content -->
        <TeamInfo
          v-else
          :team="team"
          :can-edit-name="canEditName"
          :can-edit-description="canEditDescription"
          :can-delete-team="canDeleteTeam"
          @team-updated="handleTeamUpdated"
        />
      </TeamManageTabs>
    </div>
  </NavbarLayout>
</template>
