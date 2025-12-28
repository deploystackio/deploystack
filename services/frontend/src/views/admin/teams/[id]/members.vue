<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Skeleton } from '@/components/ui/skeleton'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { TeamDetailTabs, TeamDetailPageHeading, MembersTab } from '@/components/admin/teams'
import { useTeamDetailCache } from '@/composables/admin/teams/useTeamDetailCache'

const { t } = useI18n()

const {
  team,
  isLoading,
  error,
  teamId,
  loadAndSetTeam,
  initializeCache,
  setupWatchers,
  cleanupWatchers
} = useTeamDetailCache()

onMounted(async () => {
  initializeCache()       // Load cached data first (instant display)
  await loadAndSetTeam()  // Then fetch fresh data
  setupWatchers()         // Set up route/event watchers
})

onUnmounted(() => {
  cleanupWatchers()
})
</script>

<template>
  <NavbarLayout>
    <TeamDetailPageHeading :team="team" :is-loading="isLoading" />

    <div class="space-y-6 mt-6">
      <!-- Error State -->
      <div v-if="error" class="text-red-500">
        {{ t('adminTeams.teamDetail.errorLoading', { error }) }}
      </div>

      <!-- Loading State for Content -->
      <div v-else-if="isLoading" class="space-y-4">
        <Skeleton class="h-32 w-full rounded-lg" />
        <Skeleton class="h-32 w-full rounded-lg" />
        <Skeleton class="h-32 w-full rounded-lg" />
      </div>

      <!-- Tabs with Content (sidebar + content area) -->
      <TeamDetailTabs v-else-if="team" :team="team" :team-id="teamId">
        <MembersTab :team-id="teamId" />
      </TeamDetailTabs>
    </div>
  </NavbarLayout>
</template>
