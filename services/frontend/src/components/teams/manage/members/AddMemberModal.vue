<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getEnv } from '@/utils/env'
import { toast } from 'vue-sonner'

const { t } = useI18n()

interface Props {
  open: boolean
  teamId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'member-added': []
}>()

// Form state
const isAddingMember = ref(false)
const addMemberForm = ref({
  email: '',
  role: 'team_user' as 'team_admin' | 'team_user'
})
const formErrors = ref({
  email: '',
  role: ''
})

// API helper function
const getApiUrl = () => {
  const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
  if (!apiUrl) {
    throw new Error(t('teams.manage.members.addModal.messages.apiUrlNotConfigured'))
  }
  return apiUrl
}

// Form validation
const validateForm = () => {
  let isValid = true

  // Reset errors
  formErrors.value = {
    email: '',
    role: ''
  }

  // Validate email
  if (!addMemberForm.value.email.trim()) {
    formErrors.value.email = t('teams.manage.members.addModal.messages.emailRequired')
    isValid = false
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(addMemberForm.value.email.trim())) {
      formErrors.value.email = t('teams.manage.members.addModal.messages.invalidEmail')
      isValid = false
    }
  }

  // Validate role
  if (!addMemberForm.value.role) {
    formErrors.value.role = t('teams.manage.members.addModal.messages.roleRequired')
    isValid = false
  }

  return isValid
}

// Reset form when modal opens/closes
const resetForm = () => {
  addMemberForm.value = {
    email: '',
    role: 'team_user'
  }
  formErrors.value = {
    email: '',
    role: ''
  }
}

// Handle modal open/close
const handleModalChange = (open: boolean) => {
  if (!open) {
    resetForm()
  }
  emit('update:open', open)
}

// Add member API call
const addMember = async () => {
  if (!validateForm()) {
    return
  }

  try {
    isAddingMember.value = true

    const apiUrl = getApiUrl()
    const response = await fetch(`${apiUrl}/api/teams/${props.teamId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: addMemberForm.value.email.trim(),
        role: addMemberForm.value.role
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || t('teams.manage.members.addModal.messages.addMemberFailed', { status: response.status }))
    }

    const data = await response.json()

    if (data.success) {
      // Show success toast
      const roleLabel = addMemberForm.value.role === 'team_admin'
        ? t('teams.manage.members.addModal.fields.role.options.admin')
        : t('teams.manage.members.addModal.fields.role.options.user')

      toast.success(t('teams.manage.members.addModal.messages.success'), {
        description: t('teams.manage.members.addModal.messages.successDescription', {
          email: addMemberForm.value.email,
          role: roleLabel
        })
      })

      // Close modal and emit success
      emit('update:open', false)
      emit('member-added')
    } else {
      throw new Error(data.error || t('teams.manage.members.addModal.messages.unknownError'))
    }
  } catch (error) {
    console.error('Error adding member:', error)
    toast.error(t('teams.manage.members.addModal.messages.error'), {
      description: error instanceof Error ? error.message : t('teams.manage.members.addModal.messages.unknownError')
    })
  } finally {
    isAddingMember.value = false
  }
}

const handleCancel = () => {
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="props.open" @update:open="handleModalChange">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{{ t('teams.manage.members.addModal.title') }}</DialogTitle>
        <DialogDescription>
          {{ t('teams.manage.members.addModal.description') }}
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="addMember" class="space-y-4 py-4">
        <!-- Email Field -->
        <div class="space-y-2">
          <Label for="member-email">{{ t('teams.manage.members.addModal.fields.email.label') }}</Label>
          <Input
            id="member-email"
            v-model="addMemberForm.email"
            type="email"
            :placeholder="t('teams.manage.members.addModal.fields.email.placeholder')"
            :class="{ 'border-destructive': formErrors.email }"
            :disabled="isAddingMember"
            required
          />
          <div v-if="formErrors.email" class="text-sm text-destructive">
            {{ formErrors.email }}
          </div>
        </div>

        <!-- Role Field -->
        <div class="space-y-2">
          <Label for="member-role">{{ t('teams.manage.members.addModal.fields.role.label') }}</Label>
          <Select v-model="addMemberForm.role" :disabled="isAddingMember">
            <SelectTrigger :class="{ 'border-destructive': formErrors.role }">
              <SelectValue :placeholder="t('teams.manage.members.addModal.fields.role.placeholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team_user">
                {{ t('teams.manage.members.addModal.fields.role.options.user') }}
              </SelectItem>
              <SelectItem value="team_admin">
                {{ t('teams.manage.members.addModal.fields.role.options.admin') }}
              </SelectItem>
            </SelectContent>
          </Select>
          <div v-if="formErrors.role" class="text-sm text-destructive">
            {{ formErrors.role }}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="handleCancel" :disabled="isAddingMember">
            {{ t('teams.manage.members.addModal.buttons.cancel') }}
          </Button>
          <Button
            type="submit"
            :loading="isAddingMember"
            :loading-text="t('teams.manage.members.addModal.buttons.adding')"
          >
            {{ t('teams.manage.members.addModal.buttons.add') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>