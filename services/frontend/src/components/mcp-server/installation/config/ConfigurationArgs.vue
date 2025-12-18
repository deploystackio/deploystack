<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import { Eye, EyeOff } from 'lucide-vue-next'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { DsCard } from '@/components/ui/ds-card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { McpInstallation, UserConfiguration } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
  serverData: any
  currentUserConfig: UserConfiguration | null
  teamId: string
  canEdit?: boolean
  isTeamAdmin: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canEdit: true
})

const emit = defineEmits<{
  'installation-updated': [installation: McpInstallation]
  'configuration-updated': [config: UserConfiguration]
}>()

const isEditModalOpen = ref(false)
const editingItem = ref<any>(null)
const editingValue = ref('')
const editingScope = ref<'team' | 'user'>('user')
const showPassword = ref(false)
const isSubmitting = ref(false)
const formErrors = ref<Record<string, string>>({})

const teamArgsSchema = computed(() => {
  const schema = props.installation.server?.team_args_schema || props.serverData?.team_args_schema
  if (!schema) return []
  try {
    return Array.isArray(schema) ? schema : JSON.parse(schema)
  } catch {
    return []
  }
})

const userArgsSchema = computed(() => {
  const schema = props.installation.server?.user_args_schema || props.serverData?.user_args_schema
  if (!schema) return []
  try {
    return Array.isArray(schema) ? schema : JSON.parse(schema)
  } catch {
    return []
  }
})

const currentTeamArgs = computed(() => {
  return props.installation.team_args || []
})

const currentUserArgs = computed(() => {
  return (props.currentUserConfig?.user_args as Record<string, any>) || {}
})

const teamArgsWithData = computed(() => {
  return teamArgsSchema.value.map((argSchema: any, index: number) => ({
    ...argSchema,
    index,
    currentValue: currentTeamArgs.value[index] || ''
  }))
})

const userArgsWithData = computed(() => {
  return userArgsSchema.value.map((argSchema: any) => ({
    ...argSchema,
    currentValue: currentUserArgs.value[argSchema.name] || ''
  }))
})

const openEditModal = (item: any, scope: 'team' | 'user') => {
  editingItem.value = item
  editingScope.value = scope
  editingValue.value = scope === 'team' ? item.currentValue : (currentUserArgs.value[item.name] || '')
  showPassword.value = false
  formErrors.value = {}
  isEditModalOpen.value = true
}

const closeEditModal = () => {
  isEditModalOpen.value = false
  editingItem.value = null
  editingValue.value = ''
  editingScope.value = 'user'
  showPassword.value = false
  formErrors.value = {}
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

const getInputType = (item: any) => {
  if ((item.type === 'password' || item.type === 'secret') && !showPassword.value) {
    return 'password'
  }
  return 'text'
}

const isTextarea = (item: any) => {
  return item.type === 'textarea' ||
         (item.description && item.description.toLowerCase().includes('json')) ||
         (item.placeholder && item.placeholder.length > 100)
}

const validateForm = () => {
  const errors: Record<string, string> = {}

  if (editingItem.value?.required && !editingValue.value.trim()) {
    errors.value = 'This field is required'
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const handleSubmit = async () => {
  if (!validateForm()) return

  isSubmitting.value = true

  try {
    if (editingScope.value === 'team') {
      const updatedArgs = [...currentTeamArgs.value]
      updatedArgs[editingItem.value.index] = editingValue.value

      const updatedInstallation = await McpInstallationService.updateTeamArgs(
        props.teamId,
        props.installation.id,
        updatedArgs
      )

      emit('installation-updated', updatedInstallation)

      const itemName = editingItem.value.name || `Argument #${editingItem.value.index + 1}`
      toast.success(`Team argument updated`, {
        description: `${itemName} has been updated successfully`
      })
    } else {
      if (!props.currentUserConfig) {
        const createData = {
          user_args: {
            [editingItem.value.name]: editingValue.value
          }
        }

        const newConfig = await McpInstallationService.createUserConfiguration(
          props.teamId,
          props.installation.id,
          createData
        )

        emit('configuration-updated', newConfig)
      } else {
        const updatedArgs = { ...(props.currentUserConfig.user_args as Record<string, any> || {}) }
        updatedArgs[editingItem.value.name] = editingValue.value

        const updatedConfig = await McpInstallationService.updateUserConfiguration(
          props.teamId,
          props.installation.id,
          props.currentUserConfig.id,
          { user_args: updatedArgs }
        )

        emit('configuration-updated', updatedConfig)
      }

      toast.success('User argument updated', {
        description: `${editingItem.value.name} has been updated successfully`
      })
    }

    closeEditModal()
  } catch (error) {
    console.error('Error updating argument:', error)
    toast.error('Failed to update argument', {
      description: error instanceof Error ? error.message : 'An error occurred'
    })
    formErrors.value.general = error instanceof Error ? error.message : 'Failed to update configuration'
  } finally {
    isSubmitting.value = false
  }
}

const modalTitle = computed(() => {
  if (!editingItem.value) return ''

  const itemName = editingScope.value === 'team' ?
    (editingItem.value.name || `Argument #${editingItem.value.index + 1}`) :
    editingItem.value.name

  const scope = editingScope.value === 'team' ? 'Team' : 'User'
  return `Edit ${scope} Argument: ${itemName}`
})
</script>

<template>
  <!-- Team Arguments Card (only visible to team_admin) -->
  <DsCard v-if="isTeamAdmin && teamArgsSchema.length > 0" title="Team Arguments">
    <p class="text-sm text-muted-foreground mb-4">
      Configuration managed by team administrators
    </p>

      <ul role="list" class="space-y-3">
        <li v-for="arg in teamArgsWithData" :key="arg.index" class="flex items-center justify-between gap-x-6 py-5 bg-white dark:bg-card border rounded-lg px-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-x-3">
              <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                {{ arg.name || `Argument #${arg.index + 1}` }}
              </p>
            </div>
            <div class="mt-1 text-xs/5 text-gray-700">
              <span class="font-medium text-gray-800">Required:</span>
              <span class="ml-1">{{ arg.required ? 'Yes' : 'No' }}</span>
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="space-y-1 text-xs/5 text-gray-700">
              <div v-if="arg.type">
                <span class="font-medium text-gray-800">Type:</span>
                <span class="ml-1">{{ arg.type }}</span>
              </div>
              <div v-if="arg.description">
                <span class="font-medium text-gray-800">Description:</span>
                <span class="ml-1">{{ arg.description }}</span>
              </div>
              <div>
                <span class="font-medium text-gray-800">Value:</span>
                <span v-if="arg.type === 'password' || arg.type === 'secret'" class="ml-1 font-mono">
                  {{ arg.currentValue ? '••••••••' : 'Not set' }}
                </span>
                <span v-else class="ml-1 font-mono">
                  {{ arg.currentValue || 'Not set' }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-none items-center gap-x-4">
            <Button
              v-if="canEdit"
              size="sm"
              variant="outline"
              @click="openEditModal(arg, 'team')"
            >
              Edit Value
            </Button>
            <Button
              v-else
              size="sm"
              variant="outline"
              disabled
              class="cursor-not-allowed opacity-50"
            >
              Edit Value
            </Button>
          </div>
        </li>
      </ul>
  </DsCard>

  <!-- User Arguments Card (visible to all) -->
  <DsCard v-if="userArgsSchema.length > 0" title="Your Arguments">
    <p class="text-sm text-muted-foreground mb-4">
      Your personal configuration overrides
    </p>

      <ul role="list" class="space-y-3">
        <li v-for="arg in userArgsWithData" :key="arg.name" class="flex items-center justify-between gap-x-6 py-5 bg-white dark:bg-card border rounded-lg px-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-x-3">
              <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                {{ arg.name }}
              </p>
            </div>
            <div class="mt-1 text-xs/5 text-gray-700">
              <span class="font-medium text-gray-800">Required:</span>
              <span class="ml-1">{{ arg.required ? 'Yes' : 'No' }}</span>
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="space-y-1 text-xs/5 text-gray-700">
              <div v-if="arg.type">
                <span class="font-medium text-gray-800">Type:</span>
                <span class="ml-1">{{ arg.type }}</span>
              </div>
              <div v-if="arg.description">
                <span class="font-medium text-gray-800">Description:</span>
                <span class="ml-1">{{ arg.description }}</span>
              </div>
              <div>
                <span class="font-medium text-gray-800">Value:</span>
                <span v-if="arg.type === 'password' || arg.type === 'secret'" class="ml-1 font-mono">
                  {{ arg.currentValue ? '••••••••' : 'Not set' }}
                </span>
                <span v-else class="ml-1 font-mono">
                  {{ arg.currentValue || 'Not set' }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-none items-center gap-x-4">
            <Button
              size="sm"
              variant="outline"
              @click="openEditModal(arg, 'user')"
            >
              Edit Value
            </Button>
          </div>
        </li>
      </ul>
  </DsCard>

  <!-- Edit Modal -->
    <AlertDialog :open="isEditModalOpen" @update:open="(value) => isEditModalOpen = value">
      <AlertDialogContent class="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ modalTitle }}</AlertDialogTitle>
          <AlertDialogDescription>
            Configure the value for this argument
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div v-if="editingItem" class="bg-gray-50 rounded-lg p-4 space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">Argument</span>
              <code class="bg-gray-200 text-gray-800 px-2 py-1 rounded font-mono text-xs font-semibold">
                {{ editingScope === 'team' ? (editingItem.name || `Argument #${editingItem.index + 1}`) : editingItem.name }}
              </code>
              <Badge v-if="editingItem.required" variant="default" class="text-xs">
                Required
              </Badge>
            </div>
            <div v-if="editingItem.description" class="text-sm text-gray-600">
              {{ editingItem.description }}
            </div>
          </div>

          <div v-if="formErrors.general" class="text-sm text-destructive">
            {{ formErrors.general }}
          </div>

          <div class="space-y-2">
            <Label for="config-value">{{ editingScope === 'team' ? 'Team Value' : 'User Value' }}</Label>

            <div v-if="editingItem && isTextarea(editingItem)" class="relative">
              <Textarea
                id="config-value"
                v-model="editingValue"
                :placeholder="editingItem.placeholder || 'Enter value'"
                class="min-h-[100px]"
                :class="{ 'border-destructive': formErrors.value }"
                :required="editingItem.required"
              />
            </div>

            <div v-else class="relative">
              <Input
                id="config-value"
                :type="editingItem ? getInputType(editingItem) : 'text'"
                v-model="editingValue"
                :placeholder="editingItem?.placeholder || 'Enter value'"
                :class="{ 'border-destructive': formErrors.value }"
                :required="editingItem?.required"
              />

              <Button
                v-if="editingItem?.type === 'password' || editingItem?.type === 'secret'"
                type="button"
                variant="ghost"
                size="sm"
                class="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                @click="togglePasswordVisibility"
              >
                <span class="sr-only">
                  {{ showPassword ? 'Hide value' : 'Show value' }}
                </span>
                <Eye v-if="!showPassword" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </Button>
            </div>

            <div v-if="formErrors.value" class="text-sm text-destructive">
              {{ formErrors.value }}
            </div>
          </div>

          <AlertDialogFooter>
            <Button type="button" variant="outline" @click="closeEditModal">
              Cancel
            </Button>
            <Button
              type="submit"
              :disabled="isSubmitting"
            >
              <Spinner v-if="isSubmitting" class="mr-2" />
              Save
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
</template>
