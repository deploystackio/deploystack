<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MembersList from './members/MembersList.vue'
import AddMemberModal from './members/AddMemberModal.vue'
import RemoveMemberModal from './members/RemoveMemberModal.vue'
import EditRoleModal from './members/EditRoleModal.vue'
import type { Team } from '@/services/teamService'
import { getEnv } from '@/utils/env'

const { t } = useI18n()

interface Props {
  team: Team
  canManageMembers: boolean
}

const props = defineProps<Props>()

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

// Modal states
const isAddMemberModalOpen = ref(false)
const isRemoveMemberModalOpen = ref(false)
const isEditRoleModalOpen = ref(false)
const memberToRemove = ref<TeamMember | null>(null)
const memberToEdit = ref<DisplayMember | null>(null)

// Component refs
const membersListRef = ref<InstanceType<typeof MembersList> | null>(null)

// Helper function to find team member by display member ID
const findTeamMemberByDisplayId = async (displayMemberId: string): Promise<TeamMember | null> => {
  // We need to fetch the actual team member data since the display member
  // doesn't contain all the TeamMember properties we need for removal
  try {
    const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
    if (!apiUrl) {
      throw new Error(t('teams.manage.members.messages.apiUrlNotConfigured'))
    }

    const response = await fetch(`${apiUrl}/api/teams/${props.team.id}/members`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(t('teams.manage.members.messages.fetchMembersFailed', { status: response.status }))
    }

    const data = await response.json()
    
    if (data.success && Array.isArray(data.data)) {
      return data.data.find((tm: TeamMember) => tm.user_id === displayMemberId) || null
    }
    
    return null
  } catch (error) {
    console.error('Error fetching team member:', error)
    return null
  }
}

// Event handlers
const handleAddMember = () => {
  isAddMemberModalOpen.value = true
}

const handleRemoveMember = async (displayMember: DisplayMember) => {
  const teamMember = await findTeamMemberByDisplayId(displayMember.id)
  if (teamMember) {
    memberToRemove.value = teamMember
    isRemoveMemberModalOpen.value = true
  } else {
    console.error(t('teams.manage.members.messages.memberNotFound'), displayMember)
    // You might want to show an error toast here
  }
}

const handleEditRole = (displayMember: DisplayMember) => {
  memberToEdit.value = displayMember
  isEditRoleModalOpen.value = true
}

const handleMemberAdded = async () => {
  // Reload the members list after adding a member
  if (membersListRef.value) {
    await membersListRef.value.reloadMembers()
  }
}

const handleMemberRemoved = async () => {
  // Reload the members list after removing a member
  if (membersListRef.value) {
    await membersListRef.value.reloadMembers()
  }
  memberToRemove.value = null
}

const handleRoleUpdated = async () => {
  // Reload the members list after updating a role
  if (membersListRef.value) {
    await membersListRef.value.reloadMembers()
  }
  memberToEdit.value = null
}
</script>

<template>
  <div>
    <!-- Members List Component -->
    <MembersList
      ref="membersListRef"
      :team="props.team"
      :can-manage-members="props.canManageMembers"
      @add-member="handleAddMember"
      @remove-member="handleRemoveMember"
      @edit-role="handleEditRole"
    />

    <!-- Add Member Modal -->
    <AddMemberModal
      :open="isAddMemberModalOpen"
      :team-id="props.team.id"
      @update:open="(value) => isAddMemberModalOpen = value"
      @member-added="handleMemberAdded"
    />

    <!-- Remove Member Modal -->
    <RemoveMemberModal
      :open="isRemoveMemberModalOpen"
      :team-id="props.team.id"
      :member="memberToRemove"
      @update:open="(value) => isRemoveMemberModalOpen = value"
      @member-removed="handleMemberRemoved"
    />

    <!-- Edit Role Modal -->
    <EditRoleModal
      :open="isEditRoleModalOpen"
      :team-id="props.team.id"
      :member="memberToEdit"
      @update:open="(value) => isEditRoleModalOpen = value"
      @role-updated="handleRoleUpdated"
    />
  </div>
</template>