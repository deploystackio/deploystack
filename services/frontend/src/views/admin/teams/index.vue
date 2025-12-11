<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { Input } from '@/components/ui/input'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { getEnv } from '@/utils/env'
import TeamTableColumns from './TeamTableColumns.vue'
import type { Team, TeamsApiResponse } from './types'

const { t } = useI18n()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const teams = ref<Team[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''

// Filter teams based on search query
const filteredTeams = computed(() => {
  if (!searchQuery.value) {
    return teams.value
  }
  const query = searchQuery.value.toLowerCase()
  return teams.value.filter(team => {
    return team.name.toLowerCase().includes(query) ||
           team.slug.toLowerCase().includes(query) ||
           (team.description && team.description.toLowerCase().includes(query))
  })
})

// Navigation function for viewing team details
const handleViewTeam = (teamId: string) => {
  router.push(`/admin/teams/${teamId}`)
}

// Fetch teams from API
async function fetchTeams(): Promise<Team[]> {
  if (!apiUrl) {
    throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured.')
  }

  const response = await fetch(`${apiUrl}/api/admin/teams`, {
    credentials: 'include'
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch teams: ${response.statusText} (status: ${response.status})`)
  }

  const result: TeamsApiResponse = await response.json()
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('API response for teams was not successful or data format is incorrect.')
  }

  return result.data
}

// Load teams on component mount
onMounted(async () => {
  setBreadcrumbs([{ label: t('adminTeams.title') }])

  try {
    isLoading.value = true
    teams.value = await fetchTeams()
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    teams.value = []
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <NavbarLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div>
        <p class="text-muted-foreground">{{ t('adminTeams.description') }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('adminTeams.table.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('adminTeams.table.error', { error }) }}
      </div>

      <!-- Data Table -->
      <div v-else class="space-y-4">
        <!-- Search Input -->
        <div class="flex items-center py-4">
          <Input
            :placeholder="t('adminTeams.table.search.placeholder')"
            v-model="searchQuery"
            class="max-w-sm"
          />
        </div>

        <!-- Teams Table Component -->
        <TeamTableColumns
          :teams="filteredTeams"
          :on-view-team="handleViewTeam"
        />
      </div>
    </div>
  </NavbarLayout>
</template>
