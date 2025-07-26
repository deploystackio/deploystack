<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Users, UserPlus, Info, AlertTriangle, Loader2 } from 'lucide-vue-next'
import MemberRow from './MemberRow.vue'
import type { Team } from '@/services/teamService'
import { UserService, type User } from '@/services/userService'
import { getEnv } from '@/utils/env'

const { t } = useI18n()

// Team member interface based on API response - user data is flattened
interface TeamMember {
  id: string
  user_id: string
  role: 'team_admin' | 'team_user'
  joined_at: string
  username?: string
  email: string
  first_name?: string | null
  last_name?: string | null
  is_admin: boolean
  is_owner: boolean
}

interface DisplayMember {
  id: string
  name: string
  email: string
  role: string
  joinedAt: string
}

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
  if (user.username) {
    return user.username
  }
  // Fallback to email prefix if no other name is available
  return user.email.split('@')[0]
}

// Create unified members list for display
const members = computed(() => {
  if (isDefaultTeam.value && currentUser.value) {
    // For default teams, show only the current user
    const joinedAtString = props.team.created_at instanceof Date
      ? props.team.created_at.toISOString()
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
  <div class="space-y-6">
    <!-- Default Team Notice -->
    <Alert v-if="isDefaultTeam" class="border-blue-200 bg-blue-50 text-blue-800">
      <Info class="h-4 w-4" />
      <AlertDescription>
        {{ t('teams.manage.members.defaultTeamNotice') }}
      </AlertDescription>
    </Alert>

    <!-- Team Members Overview -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">{{ t('teams.manage.members.title') }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ t('teams.manage.members.memberCount', { current: memberCount, max: 3 }) }}
        </p>
      </div>

      <Button
        v-if="canAddMembers"
        size="sm"
        class="gap-2"
        @click="handleAddMember"
      >
        <UserPlus class="h-4 w-4" />
        {{ t('teams.manage.members.addMember') }}
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="(isLoadingUser && isDefaultTeam) || (isLoadingMembers && !isDefaultTeam)" class="flex items-center justify-center py-8">
      <div class="flex items-center gap-3 text-muted-foreground">
        <Loader2 class="h-5 w-5 animate-spin" />
        {{ isDefaultTeam ? t('teams.manage.members.loadingUser') : t('teams.manage.members.loadingMembers') }}
      </div>
    </div>

    <!-- Error State -->
    <Alert v-else-if="(userError && isDefaultTeam) || (membersError && !isDefaultTeam)" variant="destructive" class="mb-4">
      <AlertTriangle class="h-4 w-4" />
      <AlertDescription>{{ isDefaultTeam ? userError : membersError }}</AlertDescription>
    </Alert>

    <!-- Members List -->
    <div v-else class="space-y-4">
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
    <div v-if="memberCount === 0 && !isDefaultTeam" class="text-center py-8 border-2 border-dashed border-muted rounded-lg">
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

    <!-- Team Limits Info -->
    <div class="bg-muted/50 rounded-lg p-4">
      <h4 class="text-sm font-medium mb-2 flex items-center gap-2">
        <Info class="h-4 w-4" />
        {{ t('teams.manage.members.info.title') }}
      </h4>
      <div class="text-xs text-muted-foreground space-y-1">
        <p>• {{ t('teams.manage.members.info.maxMembers') }}</p>
        <p>• {{ t('teams.manage.members.info.adminAccess') }}</p>
        <p>• {{ t('teams.manage.members.info.userAccess') }}</p>
        <p v-if="isDefaultTeam">• {{ t('teams.manage.members.info.defaultTeamNote') }}</p>
      </div>
    </div>
  </div>
</template>