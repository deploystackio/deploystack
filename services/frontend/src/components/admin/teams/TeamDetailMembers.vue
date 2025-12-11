<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Badge } from '@/components/ui/badge'
import { DsCard } from '@/components/ui/ds-card'
import { Users, Crown, UserCheck } from 'lucide-vue-next'
import { getEnv } from '@/utils/env'

interface TeamMember {
  id: string
  user_id: string
  username: string
  email: string
  first_name: string | null
  last_name: string | null
  role: 'team_admin' | 'team_user'
  is_admin: boolean
  is_owner: boolean
  joined_at: string
}

interface TeamMembersResponse {
  success: boolean
  data: TeamMember[]
}

const props = defineProps<{
  teamId: string
}>()

const { t } = useI18n()
const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''

const members = ref<TeamMember[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

// Fetch team members from API
async function fetchTeamMembers(id: string): Promise<TeamMembersResponse> {
  if (!apiUrl) {
    throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured.')
  }

  const response = await fetch(`${apiUrl}/api/teams/${id}/members`, {
    credentials: 'include'
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch team members: ${response.statusText} (status: ${response.status})`)
  }

  return await response.json()
}

// Get display name for member
const getMemberDisplayName = (member: TeamMember) => {
  const firstName = member.first_name || ''
  const lastName = member.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || member.username
}

// Format date for display
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

onMounted(async () => {
  try {
    isLoading.value = true
    const membersResponse = await fetchTeamMembers(props.teamId)
    members.value = membersResponse.data
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load members'
    members.value = []
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <DsCard :title="t('adminTeams.teamDetail.fields.members')">
    <p class="text-sm text-muted-foreground mb-6">
      Team members and their roles within this team.
    </p>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-muted-foreground text-sm">
      {{ t('adminTeams.teamDetail.loadingMembers') }}
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-red-500 text-sm">
      {{ t('adminTeams.teamDetail.errorLoadingMembers', { error }) }}
    </div>

    <!-- No Members -->
    <div v-else-if="members.length === 0" class="text-gray-500 text-sm">
      {{ t('adminTeams.teamDetail.noMembers') }}
    </div>

    <!-- Members List -->
    <ul v-else role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
      <li
        v-for="member in members"
        :key="member.id"
        class="flex items-center justify-between py-4 pr-5 pl-4 text-sm"
      >
        <div class="flex w-0 flex-1 items-center">
          <Users class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
          <div class="ml-4 flex min-w-0 flex-1 gap-2">
            <div class="flex flex-col">
              <span class="truncate font-medium">{{ getMemberDisplayName(member) }}</span>
              <span class="truncate text-xs text-gray-500">{{ member.email }}</span>
              <span class="truncate text-xs text-gray-400">{{ t('adminTeams.teamDetail.values.joined') }} {{ formatDate(member.joined_at) }}</span>
            </div>
          </div>
        </div>
        <div class="ml-4 shrink-0 flex gap-2">
          <!-- Owner Badge -->
          <Badge v-if="member.is_owner" variant="default" class="text-xs flex items-center gap-1">
            <Crown class="h-3 w-3" />
            {{ t('adminTeams.teamDetail.values.owner') }}
          </Badge>
          <!-- Role Badge -->
          <Badge v-else-if="member.role" variant="outline" class="text-xs flex items-center gap-1">
            <UserCheck class="h-3 w-3" />
            {{ member.role === 'team_admin' ? t('adminTeams.teamDetail.values.admin') : t('adminTeams.teamDetail.values.member') }}
          </Badge>
        </div>
      </li>
    </ul>
  </DsCard>
</template>
