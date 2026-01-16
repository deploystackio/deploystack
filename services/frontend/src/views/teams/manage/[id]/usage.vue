<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Skeleton } from '@/components/ui/skeleton'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { TeamManageHeader, TeamManageTabs, TeamUsage } from '@/components/teams/manage'
import { useTeamCache } from '@/composables/teams/useTeamCache'
import { useEventBus } from '@/composables/useEventBus'

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
  cleanupWatchers
} = useTeamCache()

// Handle team selection from sidebar
const handleTeamSelected = (data: { teamId: string; teamName: string }) => {
  // If we're switching to a different team, navigate to that team's usage page
  if (data.teamId !== teamId) {
    router.push(`/teams/manage/${data.teamId}/usage`)
  }
}

// Load team on component mount
onMounted(async () => {
  initializeCache()
  await loadAndSetTeam()
  setupWatchers()

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
        <TeamUsage
          v-else
          :team="team"
        />
      </TeamManageTabs>
    </div>
  </NavbarLayout>
</template>
