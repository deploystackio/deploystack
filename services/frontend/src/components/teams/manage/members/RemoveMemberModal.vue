<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Users } from 'lucide-vue-next'
import { getEnv } from '@/utils/env'
import { toast } from 'vue-sonner'

const { t } = useI18n()

// Team member interface
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

interface Props {
  open: boolean
  teamId: string
  member: TeamMember | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'member-removed': []
}>()

// State
const isRemovingMember = ref(false)

// API helper function
const getApiUrl = () => {
  const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
  if (!apiUrl) {
    throw new Error(t('teams.manage.members.removeModal.messages.apiUrlNotConfigured'))
  }
  return apiUrl
}

// Helper function to get display name
const getDisplayName = (member: TeamMember): string => {
  if (!member) {
    return t('teams.manage.members.removeModal.messages.unknownUser')
  }

  if (member.first_name && member.last_name) {
    return `${member.first_name} ${member.last_name}`
  }
  if (member.first_name) {
    return member.first_name
  }
  if (member.username) {
    return member.username
  }
  // Fallback to email prefix if no other name is available
  return member.email.split('@')[0]
}

// Get role label
const getRoleLabel = (member: TeamMember) => {
  if (member.is_owner) {
    return t('teams.manage.members.roles.owner')
  }
  
  switch (member.role) {
    case 'team_admin':
      return t('teams.manage.members.roles.admin')
    default:
      return t('teams.manage.members.roles.user')
  }
}

// Handle modal open/close
const handleModalChange = (open: boolean) => {
  if (!open && !isRemovingMember.value) {
    emit('update:open', false)
  }
}

// Remove member API call
const removeMember = async () => {
  if (!props.member) {
    console.error(t('teams.manage.members.removeModal.messages.noMemberToRemove'))
    return
  }

  try {
    isRemovingMember.value = true

    const apiUrl = getApiUrl()
    const deleteUrl = `${apiUrl}/api/teams/${props.teamId}/members/${props.member.user_id}`

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || t('teams.manage.members.removeModal.messages.removeMemberFailed', { status: response.status }))
    }

    const data = await response.json()

    if (data.success) {
      // Show success toast
      toast.success(t('teams.manage.members.removeModal.messages.success'), {
        description: t('teams.manage.members.removeModal.messages.successDescription', {
          email: props.member.email
        })
      })

      // Close modal and emit success
      emit('update:open', false)
      emit('member-removed')
    } else {
      throw new Error(data.error || t('teams.manage.members.removeModal.messages.unknownError'))
    }
  } catch (error) {
    console.error('Error removing member:', error)
    toast.error(t('teams.manage.members.removeModal.messages.error'), {
      description: error instanceof Error ? error.message : t('teams.manage.members.removeModal.messages.unknownError')
    })
  } finally {
    isRemovingMember.value = false
  }
}

const handleCancel = () => {
  emit('update:open', false)
}
</script>

<template>
  <AlertDialog :open="props.open" @update:open="handleModalChange">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('teams.manage.members.removeModal.title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('teams.manage.members.removeModal.description') }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div v-if="props.member" class="py-4">
        <div class="bg-muted/50 rounded-lg p-4">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Users class="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p class="font-medium">{{ getDisplayName(props.member) }}</p>
              <p class="text-sm text-muted-foreground">{{ props.member.email }}</p>
              <p class="text-xs text-muted-foreground">
                {{ getRoleLabel(props.member) }}
              </p>
            </div>
          </div>
        </div>

        <div class="mt-4 text-sm text-muted-foreground">
          <p>{{ t('teams.manage.members.removeModal.warning') }}</p>
        </div>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel @click="handleCancel">
          {{ t('teams.manage.members.removeModal.buttons.cancel') }}
        </AlertDialogCancel>
        <Button
          @click="removeMember"
          :disabled="isRemovingMember"
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {{ isRemovingMember ? t('teams.manage.members.removeModal.buttons.removing') : t('teams.manage.members.removeModal.buttons.remove') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>