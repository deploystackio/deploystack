<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DsCard } from '@/components/ui/ds-card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Mail, Github, Shield } from 'lucide-vue-next'
import { getEnv } from '@/utils/env'
import type { User } from '@/views/admin/users/types'

const props = defineProps<{
  user: User
}>()

const emit = defineEmits<{
  roleChanged: []
}>()

const { t } = useI18n()

// Dialog state
const isDialogOpen = ref(false)
const selectedRole = ref(props.user.role_id || 'global_user')
const isChangingRole = ref(false)

// Computed properties for display
const displayName = computed(() => {
  const firstName = props.user.first_name || ''
  const lastName = props.user.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || props.user.username
})

const authTypeBadge = computed(() => {
  const isEmail = props.user.auth_type === 'email_signup'
  return {
    variant: (isEmail ? 'default' : 'secondary') as 'default' | 'secondary',
    icon: isEmail ? Mail : Github,
    text: isEmail ? t('adminUsers.userDetail.values.email') : t('adminUsers.userDetail.values.github')
  }
})

// Role options
const roleOptions = [
  { value: 'global_admin', label: 'Global Administrator' },
  { value: 'global_user', label: 'Global User' }
]

// Change role handler
async function handleChangeRole() {
  if (!selectedRole.value || selectedRole.value === props.user.role_id) {
    isDialogOpen.value = false
    return
  }

  try {
    isChangingRole.value = true
    const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

    const response = await fetch(`${apiUrl}/api/admin/users/${props.user.id}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        role_id: selectedRole.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to change role')
    }

    toast.success('Role changed successfully', {
      description: `User role updated to ${roleOptions.find(r => r.value === selectedRole.value)?.label}`
    })

    isDialogOpen.value = false
    emit('roleChanged')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    toast.error('Failed to change role', {
      description: errorMessage
    })
  } finally {
    isChangingRole.value = false
  }
}

// Reset selected role when dialog opens
function handleDialogOpen(open: boolean) {
  isDialogOpen.value = open
  if (open) {
    selectedRole.value = props.user.role_id || 'global_user'
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- User Information Card -->
    <DsCard :title="t('adminUsers.userDetail.userInformation')">
      <p class="text-sm text-muted-foreground mb-6">
        {{ t('adminUsers.userDetail.personalDetails') }}
      </p>

      <dl class="divide-y divide-gray-100">
        <!-- Full Name -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.fullName') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
            {{ displayName === user.username ? t('adminUsers.userDetail.values.notProvided') : displayName }}
          </dd>
        </div>

        <!-- Username -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.username') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">{{ user.username }}</dd>
        </div>

        <!-- Email -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.emailAddress') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">{{ user.email }}</dd>
        </div>

        <!-- Registration Method -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.registrationMethod') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
            <Badge
              :variant="authTypeBadge.variant"
              class="flex items-center gap-1 w-fit"
            >
              <component :is="authTypeBadge.icon" class="h-3 w-3" />
              {{ authTypeBadge.text }}
            </Badge>
          </dd>
        </div>

        <!-- GitHub ID (if applicable) -->
        <div v-if="user.github_id" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.githubId') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
            <span class="font-mono">{{ user.github_id }}</span>
          </dd>
        </div>

        <!-- User Details -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.accountDetails') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
            <div class="space-y-2">
              <div><span class="font-medium">{{ t('adminUsers.userDetail.values.firstName') }}</span> {{ user.first_name || t('adminUsers.userDetail.values.notProvided') }}</div>
              <div><span class="font-medium">{{ t('adminUsers.userDetail.values.lastName') }}</span> {{ user.last_name || t('adminUsers.userDetail.values.notProvided') }}</div>
              <div><span class="font-medium">{{ t('adminUsers.userDetail.values.userId') }}</span> <span class="font-mono text-xs">{{ user.id }}</span></div>
            </div>
          </dd>
        </div>
      </dl>
    </DsCard>

    <!-- Role Card -->
    <DsCard :title="t('adminUsers.userDetail.fields.role')">
      <p class="text-sm text-muted-foreground mb-6">
        User role and permissions within the DeployStack system
      </p>

      <dl class="divide-y divide-gray-100">
        <!-- Role ID -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">Role</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
            {{ user.role_id || t('adminUsers.userDetail.values.noRoleAssigned') }}
          </dd>
        </div>
      </dl>

      <template #footer-actions>
        <Dialog :open="isDialogOpen" @update:open="handleDialogOpen">
          <DialogTrigger as-child>
            <Button>
              Change Role
            </Button>
          </DialogTrigger>
          <DialogContent class="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
              <DialogDescription>
                Update the role for {{ user.username }}. This will affect their permissions across the system.
              </DialogDescription>
            </DialogHeader>

            <div class="space-y-4 py-4">
              <div class="space-y-2">
                <label class="text-sm font-medium">Select Role</label>
                <Select v-model="selectedRole">
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in roleOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" @click="isDialogOpen = false" :disabled="isChangingRole">
                Cancel
              </Button>
              <Button
                @click="handleChangeRole"
                :loading="isChangingRole"
                loading-text="Changing..."
                :disabled="isChangingRole || selectedRole === user.role_id"
              >
                Change Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </template>
    </DsCard>

    <!-- Permissions Card -->
    <DsCard v-if="user.role && user.role.permissions.length > 0" :title="t('adminUsers.userDetail.fields.permissions')">
      <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
        <li
          v-for="permission in user.role.permissions"
          :key="permission"
          class="flex items-center justify-between py-4 pr-5 pl-4 text-sm"
        >
          <div class="flex w-0 flex-1 items-center">
            <Shield class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
            <div class="ml-4 flex min-w-0 flex-1 gap-2">
              <span class="truncate font-medium">{{ permission }}</span>
            </div>
          </div>
          <div class="ml-4 shrink-0">
            <Badge variant="outline" class="text-xs">{{ t('adminUsers.userDetail.values.active') }}</Badge>
          </div>
        </li>
      </ul>
    </DsCard>
  </div>
</template>
