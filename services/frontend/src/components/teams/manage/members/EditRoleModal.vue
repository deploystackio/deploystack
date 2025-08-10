<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

interface DisplayMember {
  id: string
  name: string
  email: string
  role: string
  joinedAt: string
}

interface Props {
  open: boolean
  teamId: string
  member: DisplayMember | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'role-updated': []
}>()

// State
const isUpdatingRole = ref(false)
const selectedRole = ref<'team_admin' | 'team_user'>('team_user')

// Role options
const roleOptions = [
  {
    value: 'team_admin' as const,
    label: t('teams.manage.members.roles.admin'),
    description: t('teams.manage.members.editRoleModal.roleDescriptions.admin')
  },
  {
    value: 'team_user' as const,
    label: t('teams.manage.members.roles.user'),
    description: t('teams.manage.members.editRoleModal.roleDescriptions.user')
  }
]

// Computed properties
const currentRole = computed(() => {
  if (!props.member) return null

  // Convert display role back to API role
  if (props.member.role === 'team_owner') return 'team_admin'
  return props.member.role as 'team_admin' | 'team_user'
})

const isOwner = computed(() => {
  return props.member?.role === 'team_owner'
})

const canChangeRole = computed(() => {
  return !isOwner.value && props.member
})

const isRoleChanged = computed(() => {
  return selectedRole.value !== currentRole.value
})

// API helper function
const getApiUrl = () => {
  const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
  if (!apiUrl) {
    throw new Error(t('teams.manage.members.editRoleModal.messages.apiUrlNotConfigured'))
  }
  return apiUrl
}

// Initialize selected role when modal opens
const initializeRole = () => {
  if (currentRole.value) {
    selectedRole.value = currentRole.value
  }
}

// Handle modal open/close
const handleModalChange = (open: boolean) => {
  if (open) {
    initializeRole()
  }

  if (!open && !isUpdatingRole.value) {
    emit('update:open', false)
  }
}

// Update member role API call
const updateMemberRole = async () => {
  if (!props.member || !canChangeRole.value || !isRoleChanged.value) {
    return
  }

  try {
    isUpdatingRole.value = true

    const apiUrl = getApiUrl()
    const updateUrl = `${apiUrl}/api/teams/${props.teamId}/members/${props.member.id}/role`

    const response = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        role: selectedRole.value
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || t('teams.manage.members.editRoleModal.messages.updateRoleFailed', { status: response.status }))
    }

    const data = await response.json()

    if (data.success) {
      // Show success toast
      const roleLabel = roleOptions.find(r => r.value === selectedRole.value)?.label || selectedRole.value
      toast.success(t('teams.manage.members.editRoleModal.messages.success'), {
        description: t('teams.manage.members.editRoleModal.messages.successDescription', { 
          memberName: props.member.name, 
          role: roleLabel 
        })
      })

      // Close modal and emit success
      emit('update:open', false)
      emit('role-updated')
    } else {
      throw new Error(data.error || t('teams.manage.members.editRoleModal.messages.unknownError'))
    }
  } catch (error) {
    console.error('Error updating member role:', error)
    toast.error(t('teams.manage.members.editRoleModal.messages.error'), {
      description: error instanceof Error ? error.message : t('teams.manage.members.editRoleModal.messages.unknownError')
    })
  } finally {
    isUpdatingRole.value = false
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
        <AlertDialogTitle>{{ $t('teams.manage.members.editRoleModal.title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t('teams.manage.members.editRoleModal.description') }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div v-if="props.member" class="space-y-6">
        <!-- Member Information -->
        <div class="bg-muted/50 rounded-lg p-4">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Users class="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p class="font-medium">{{ props.member.name }}</p>
              <p class="text-sm text-muted-foreground">{{ props.member.email }}</p>
            </div>
          </div>
        </div>

        <!-- Owner Notice -->
        <div v-if="isOwner" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p class="text-sm text-blue-800">
            <strong>{{ $t('teams.manage.members.editRoleModal.ownerNotice.title') }}:</strong> {{ $t('teams.manage.members.editRoleModal.ownerNotice.description') }}
          </p>
        </div>

        <!-- Role Selection -->
        <div v-else class="space-y-4">
          <!-- Current Role Display -->
          <div class="space-y-2">
            <Label class="text-sm font-medium">{{ $t('teams.manage.members.editRoleModal.currentRole.label') }}</Label>
            <div class="p-3 bg-muted/30 rounded-md">
              <p class="text-sm">
                {{ roleOptions.find(r => r.value === currentRole)?.label || $t('teams.manage.members.editRoleModal.currentRole.unknown') }}
              </p>
            </div>
          </div>

          <!-- New Role Selection -->
          <div class="space-y-2">
            <Label for="role-select" class="text-sm font-medium">{{ $t('teams.manage.members.editRoleModal.newRole.label') }}</Label>
            <Select v-model="selectedRole">
              <SelectTrigger id="role-select">
                <SelectValue :placeholder="$t('teams.manage.members.editRoleModal.newRole.placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in roleOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  <div class="space-y-1">
                    <div class="font-medium">{{ option.label }}</div>
                    <div class="text-xs text-muted-foreground">{{ option.description }}</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel @click="handleCancel">
          {{ $t('teams.manage.members.editRoleModal.buttons.cancel') }}
        </AlertDialogCancel>
        <Button
          v-if="canChangeRole"
          @click="updateMemberRole"
          :disabled="!isRoleChanged"
          :loading="isUpdatingRole"
          :loading-text="$t('teams.manage.members.editRoleModal.buttons.updating')"
        >
          {{ $t('teams.manage.members.editRoleModal.buttons.update') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
