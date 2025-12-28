<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Badge } from '@/components/ui/badge'
import { DsCard } from '@/components/ui/ds-card'
import { Users, Crown, UserCheck } from 'lucide-vue-next'
import { getEnv } from '@/utils/env'

interface Team {
  id: string
  name: string
  slug: string
  description: string | null
  owner_id: string
  created_at: string
  updated_at: string
  role?: 'team_admin' | 'team_user'
  is_owner?: boolean
}

interface TeamsResponse {
  success: boolean
  teams: Team[]
}

const props = defineProps<{
  userId: string
}>()

const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''

const teams = ref<Team[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

// Fetch user teams from API
async function fetchUserTeams(id: string): Promise<TeamsResponse> {
  if (!apiUrl) {
    throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured.')
  }

  const response = await fetch(`${apiUrl}/api/users/${id}/teams`, {
    credentials: 'include'
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch user teams: ${response.statusText} (status: ${response.status})`)
  }

  return await response.json()
}

onMounted(async () => {
  try {
    isLoading.value = true
    const teamsResponse = await fetchUserTeams(props.userId)
    teams.value = teamsResponse.teams
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load teams'
    teams.value = []
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <DsCard title="Teams">
    <p class="text-sm text-muted-foreground mb-6">
      Teams this user belongs to and their role in each team.
    </p>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-muted-foreground text-sm">
      Loading teams...
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-red-500 text-sm">
      Error loading teams: {{ error }}
    </div>

    <!-- No Teams -->
    <div v-else-if="teams.length === 0" class="text-gray-500 text-sm">
      This user is not a member of any teams.
    </div>

    <!-- Teams List -->
    <ul v-else role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
      <li
        v-for="team in teams"
        :key="team.id"
        class="flex items-center justify-between py-4 pr-5 pl-4 text-sm"
      >
        <div class="flex w-0 flex-1 items-center">
          <Users class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
          <div class="ml-4 flex min-w-0 flex-1 gap-2">
            <div class="flex flex-col">
              <span class="truncate font-medium">{{ team.name }}</span>
              <span v-if="team.description" class="truncate text-xs text-gray-500">{{ team.description }}</span>
              <span class="truncate text-xs text-gray-400">Created: {{ new Date(team.created_at).toLocaleDateString() }}</span>
            </div>
          </div>
        </div>
        <div class="ml-4 shrink-0 flex gap-2">
          <!-- Owner Badge -->
          <Badge v-if="team.is_owner" variant="default" class="text-xs flex items-center gap-1">
            <Crown class="h-3 w-3" />
            Owner
          </Badge>
          <!-- Role Badge -->
          <Badge v-else-if="team.role" variant="outline" class="text-xs flex items-center gap-1">
            <UserCheck class="h-3 w-3" />
            {{ team.role === 'team_admin' ? 'Admin' : 'Member' }}
          </Badge>
        </div>
      </li>
    </ul>
  </DsCard>
</template>
