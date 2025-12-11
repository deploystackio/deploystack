<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, UserPlus, Info, AlertTriangle } from 'lucide-vue-next'
import MemberRow from './MemberRow.vue'
import { DsCard } from '@/components/ui/ds-card'
import type { Team } from '@/services/teamService'
import { UserService, type User } from '@/services/userService'
import { getEnv } from '@/utils/env'
import type { TeamMember, DisplayMember } from '@/types/team'

const { t } = useI18n()

interface Props {
  team: Team
  canManageMembers: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'add-member': []
  'remove-member': [member: DisplayMember]
  'edit-role': [member: DisplayMember]
}>()

// State
const currentUser = ref<User | null>(null)
const teamMembers = ref<TeamMember[]>([])
const isLoadingUser = ref(false)
const isLoadingMembers = ref(false)
const userError = ref<string | null>(null)
const membersError = ref<string | null>(null)

// Computed properties
const isDefaultTeam = computed(() => {
  return props.team.is_default === true
})

// Helper function to get display name from user object or team member
const getDisplayName = (user: User | TeamMember): string => {
  // Handle case where user might be undefined
  if (!user) {
    return t('teams.manage.members.unknownUser')
  }

  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`
  }
  if (user.first_name) {
    return user.first_name
  }
  // Skip username check and go directly to email fallback
  return (user.email || '').split('@')[0] || 'Unknown'
}

// Create unified members list for display
const members = computed(() => {
  if (isDefaultTeam.value && currentUser.value) {
    // For default teams, show only the current user
    const joinedAtString = typeof props.team.created_at === 'string'
      ? props.team.created_at
      : new Date(props.team.created_at).toISOString()

    return [{
      id: currentUser.value.id,
      name: getDisplayName(currentUser.value),
      email: currentUser.value.email,
      role: 'team_owner',
      joinedAt: joinedAtString
    }]
  } else {
    // For non-default teams, show actual team members
    return teamMembers.value.map(member => ({
      id: member.user_id,
      name: getDisplayName(member),
      email: member.email,
      role: member.is_owner ? 'team_owner' : member.role,
      joinedAt: member.joined_at
    }))
  }
})

const memberCount = computed(() => members.value.length)
const canAddMembers = computed(() => props.canManageMembers && !isDefaultTeam.value && memberCount.value < 3)

// API helper function
const getApiUrl = () => {
  const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
  if (!apiUrl) {
    throw new Error(t('teams.manage.members.messages.apiUrlNotConfigured'))
  }
  return apiUrl
}

// Load current user data
const loadCurrentUser = async () => {
  try {
    isLoadingUser.value = true
    userError.value = null

    const user = await UserService.getCurrentUser()
    if (user) {
      currentUser.value = user
    } else {
      userError.value = t('teams.manage.members.errors.unableToLoadUser')
    }
  } catch (error) {
    console.error('Error loading current user:', error)
    userError.value = error instanceof Error ? error.message : t('teams.manage.members.errors.failedToLoadUser')
  } finally {
    isLoadingUser.value = false
  }
}

// Load team members for non-default teams
const loadTeamMembers = async () => {
  try {
    isLoadingMembers.value = true
    membersError.value = null

    const apiUrl = getApiUrl()
    const response = await fetch(`${apiUrl}/api/teams/${props.team.id}/members`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(t('teams.manage.members.errors.unauthorized'))
      }
      throw new Error(t('teams.manage.members.messages.fetchMembersFailed', { status: response.status }))
    }

    const data = await response.json()

    if (data.success && Array.isArray(data.data)) {
      teamMembers.value = data.data
    } else {
      throw new Error(t('teams.manage.members.errors.invalidResponse'))
    }
  } catch (error) {
    console.error('Error loading team members:', error)
    membersError.value = error instanceof Error ? error.message : t('teams.manage.members.errors.failedToLoadMembers')
  } finally {
    isLoadingMembers.value = false
  }
}

// Expose reload function
const reloadMembers = async () => {
  if (isDefaultTeam.value) {
    await loadCurrentUser()
  } else {
    await loadTeamMembers()
  }
}

// Load data on mount
onMounted(async () => {
  await reloadMembers()
})

// Event handlers
const handleAddMember = () => {
  emit('add-member')
}

const handleRemoveMember = (member: DisplayMember) => {
  emit('remove-member', member)
}

const handleEditRole = (member: DisplayMember) => {
  emit('edit-role', member)
}

// Expose reload function to parent
defineExpose({
  reloadMembers
})
</script>

<template>
  <div>
    <DsCard :title="t('teams.manage.members.title')">
      <p class="text-sm text-muted-foreground">
        {{ t('teams.manage.members.memberCount', { current: memberCount, max: 3 }) }}
      </p>

      <div class="text-sm text-muted-foreground mt-4 mb-6 space-y-1">
        <p>• {{ t('teams.manage.members.info.maxMembers') }}</p>
        <p>• {{ t('teams.manage.members.info.adminAccess') }}</p>
        <p>• {{ t('teams.manage.members.info.userAccess') }}</p>
      </div>

      <!-- Default Team Notice -->
      <Alert v-if="isDefaultTeam" class="border-blue-200 bg-blue-50 text-blue-800 mb-6">
        <Info class="h-4 w-4" />
        <AlertDescription>
          {{ t('teams.manage.members.defaultTeamNotice') }}
        </AlertDescription>
      </Alert>

      <!-- Loading State with Skeleton -->
      <div v-if="(isLoadingUser && isDefaultTeam) || (isLoadingMembers && !isDefaultTeam)" class="space-y-4">
        <div v-for="i in 2" :key="i" class="flex items-center justify-between py-4 border-b last:border-b-0">
          <div class="flex items-center gap-4">
            <Skeleton class="h-10 w-10 rounded-full" />
            <div class="space-y-2">
              <Skeleton class="h-4 w-32" />
              <Skeleton class="h-3 w-48" />
            </div>
          </div>
          <div class="flex items-center gap-4">
            <Skeleton class="h-5 w-16 rounded-full" />
            <Skeleton class="h-3 w-24" />
          </div>
        </div>
      </div>

      <!-- Error State -->
      <Alert v-else-if="(userError && isDefaultTeam) || (membersError && !isDefaultTeam)" variant="destructive" class="mb-4">
        <AlertTriangle class="h-4 w-4" />
        <AlertDescription>{{ isDefaultTeam ? userError : membersError }}</AlertDescription>
      </Alert>

      <!-- Members List -->
      <div v-else-if="members.length > 0" class="space-y-4">
        <MemberRow
          v-for="member in members"
          :key="member.id"
          :member="member"
          :can-manage-members="canManageMembers"
          @remove-member="handleRemoveMember"
          @edit-role="handleEditRole"
        />
      </div>

      <!-- Empty State for No Additional Members (only for non-default teams) -->
      <div v-else-if="memberCount === 0 && !isDefaultTeam" class="text-center py-8 border-2 border-dashed border-muted rounded-lg">
        <Users class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h4 class="text-lg font-medium mb-2">{{ t('teams.manage.members.noMembers.title') }}</h4>
        <p class="text-sm text-muted-foreground mb-4">
          {{ t('teams.manage.members.noMembers.description') }}
        </p>
        <Button v-if="canAddMembers" class="gap-2" @click="handleAddMember">
          <UserPlus class="h-4 w-4" />
          {{ t('teams.manage.members.noMembers.addFirstMember') }}
        </Button>
      </div>

      <template #footer-status>
        <span>
          Read more about teams in our
          <a
            href="https://docs.deploystack.io/general/teams"
            target="_blank"
            class="text-primary underline underline-offset-4 hover:text-primary/80"
          >team documentation</a>.
        </span>
      </template>

      <template v-if="canAddMembers" #footer-actions>
        <Button
          class="gap-2"
          @click="handleAddMember"
        >
          <UserPlus class="h-4 w-4" />
          {{ t('teams.manage.members.addMember') }}
        </Button>
      </template>
    </DsCard>
  </div>
</template>
