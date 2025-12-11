<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Crown, UserCheck, Pencil } from 'lucide-vue-next'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { TeamService } from '@/services/teamService'
import { getEnv } from '@/utils/env'
import type { Team } from './types'

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

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const team = ref<Team | null>(null)
const members = ref<TeamMember[]>([])
const isLoading = ref(true)
const isLoadingMembers = ref(false)
const error = ref<string | null>(null)
const membersError = ref<string | null>(null)

const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''
const teamId = route.params.id as string

// Fetch team details from API using new admin endpoint
async function fetchTeam(id: string): Promise<Team> {
  return await TeamService.getTeamAsAdmin(id)
}

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

// Load team and members on component mount
onMounted(async () => {
  setBreadcrumbs([
    { label: t('adminTeams.title'), href: '/admin/teams' },
    { label: t('adminTeams.teamDetail.titleLoading') }
  ])

  try {
    isLoading.value = true
    team.value = await fetchTeam(teamId)
    error.value = null

    // Update breadcrumbs with team name
    setBreadcrumbs([
      { label: t('adminTeams.title'), href: '/admin/teams' },
      { label: team.value.name }
    ])

    // Fetch members after team is loaded
    try {
      isLoadingMembers.value = true
      const membersResponse = await fetchTeamMembers(teamId)
      members.value = membersResponse.data
      membersError.value = null
    } catch (err) {
      membersError.value = err instanceof Error ? err.message : 'Failed to load members'
      members.value = []
    } finally {
      isLoadingMembers.value = false
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    team.value = null
  } finally {
    isLoading.value = false
  }
})

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

const goToEdit = () => {
  router.push(`/admin/teams/edit/${teamId}`)
}
</script>

<template>
  <NavbarLayout>
    <div class="space-y-6">
      <!-- Edit Button -->
      <div v-if="team" class="flex justify-end">
        <Button
          variant="outline"
          @click="goToEdit"
        >
          <Pencil class="h-4 w-4 mr-2" />
          {{ t('adminTeams.teamDetail.actions.edit') }}
        </Button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('adminTeams.teamDetail.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('adminTeams.teamDetail.errorLoading', { error }) }}
      </div>

      <!-- Team Details -->
      <div v-else-if="team">
        <div class="px-4 sm:px-0">
          <h3 class="text-base/7 font-semibold text-gray-900">{{ t('adminTeams.teamDetail.teamInformation') }}</h3>
          <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('adminTeams.teamDetail.teamDetails') }}</p>
        </div>
        <div class="mt-6 border-t border-gray-100">
          <dl class="divide-y divide-gray-100">
            <!-- Team Name -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.name') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                {{ team.name }}
              </dd>
            </div>

            <!-- Slug -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.slug') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <span class="font-mono">{{ team.slug }}</span>
              </dd>
            </div>

            <!-- Description -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.description') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                {{ team.description || t('adminTeams.teamDetail.values.noDescription') }}
              </dd>
            </div>

            <!-- Type -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.type') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <Badge
                  :variant="team.is_default ? 'default' : 'secondary'"
                  class="w-fit"
                >
                  {{ team.is_default ? t('adminTeams.table.typeDefault') : t('adminTeams.table.typeCustom') }}
                </Badge>
              </dd>
            </div>

            <!-- Total MCP Server Limit -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.totalMcpLimit') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                {{ team.mcp_server_limit }}
              </dd>
            </div>

            <!-- Non-HTTP MCP Limit -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.mcpLimit') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                {{ team.non_http_mcp_limit }}
              </dd>
            </div>

            <!-- Team Details -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.teamDetails') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div><span class="font-medium">{{ t('adminTeams.teamDetail.values.teamId') }}</span> <span class="font-mono text-xs">{{ team.id }}</span></div>
                  <div><span class="font-medium">{{ t('adminTeams.teamDetail.values.createdAt') }}</span> {{ formatDate(team.created_at) }}</div>
                  <div><span class="font-medium">{{ t('adminTeams.teamDetail.values.updatedAt') }}</span> {{ formatDate(team.updated_at) }}</div>
                </div>
              </dd>
            </div>

            <!-- Members -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.members') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <!-- Members Loading State -->
                <div v-if="isLoadingMembers" class="text-muted-foreground text-sm">
                  {{ t('adminTeams.teamDetail.loadingMembers') }}
                </div>

                <!-- Members Error State -->
                <div v-else-if="membersError" class="text-red-500 text-sm">
                  {{ t('adminTeams.teamDetail.errorLoadingMembers', { error: membersError }) }}
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
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
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
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </NavbarLayout>
</template>
