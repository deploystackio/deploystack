<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Eye, EyeOff, Trash2 } from 'lucide-vue-next'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { DsCard } from '@/components/ui/ds-card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  isGithubDeployment?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canEdit: true,
  isGithubDeployment: false
})

const emit = defineEmits<{
  'installation-updated': [installation: McpInstallation]
  'configuration-updated': [config: UserConfiguration]
  'config-removed': []
}>()

const { t } = useI18n()

const isEditModalOpen = ref(false)
const editingItem = ref<any>(null)
const editingValue = ref('')
const editingScope = ref<'team' | 'user'>('user')
const showPassword = ref(false)
const isSubmitting = ref(false)
const formErrors = ref<Record<string, string>>({})

// Remove confirmation state
const isRemoveDialogOpen = ref(false)
const removingItemName = ref('')
const isRemoving = ref(false)

// Batch update state: track pending changes not yet saved to backend
const pendingTeamChanges = ref<string[]>([])
const pendingUserChanges = ref<Record<string, string>>({})
const isSavingTeam = ref(false)
const isSavingUser = ref(false)

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

// Merged values: combine original with pending changes
const mergedTeamArgs = computed(() => {
  return pendingTeamChanges.value.length > 0
    ? pendingTeamChanges.value
    : currentTeamArgs.value
})

const mergedUserArgs = computed(() => {
  return { ...currentUserArgs.value, ...pendingUserChanges.value }
})

// Check if there are unsaved changes
const hasTeamChanges = computed(() => pendingTeamChanges.value.length > 0)
const hasUserChanges = computed(() => Object.keys(pendingUserChanges.value).length > 0)

const teamArgsWithData = computed(() => {
  return teamArgsSchema.value.map((argSchema: any, index: number) => ({
    ...argSchema,
    index,
    currentValue: mergedTeamArgs.value[index] || ''
  }))
})

const userArgsWithData = computed(() => {
  return userArgsSchema.value.map((argSchema: any) => ({
    ...argSchema,
    currentValue: mergedUserArgs.value[argSchema.name] || ''
  }))
})

const openEditModal = (item: any, scope: 'team' | 'user') => {
  editingItem.value = item
  editingScope.value = scope

  // Show pending value if exists, otherwise original value
  if (scope === 'team') {
    editingValue.value = (pendingTeamChanges.value.length > 0 ?  pendingTeamChanges.value[item.index] : currentTeamArgs.value[item.index]) || ''
  } else {
    editingValue.value = pendingUserChanges.value[item.name] ?? currentUserArgs.value[item.name] ?? ''
  }

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

const isBoolean = (item: any) => {
  return item?.type === 'boolean'
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

  // Store item name BEFORE closing modal (closeEditModal sets editingItem to null)
  const itemName = editingScope.value === 'team' ?
    (editingItem.value.name || `Argument #${editingItem.value.index + 1}`) :
    editingItem.value.name

  // Save to pending changes (NO API CALL)
  if (editingScope.value === 'team') {
    const newArgs = [...(pendingTeamChanges.value.length > 0 ? pendingTeamChanges.value : currentTeamArgs.value)]
    newArgs[editingItem.value.index] = editingValue.value
    pendingTeamChanges.value = newArgs
  } else {
    pendingUserChanges.value = {
      ...pendingUserChanges.value,
      [editingItem.value.name]: editingValue.value
    }
  }

  closeEditModal()

  // Show feedback
  toast.info('Change saved', {
    description: `${itemName} will be updated when you click "Save & Restart"`
  })
}

const saveTeamChanges = async () => {
  if (!hasTeamChanges.value) return

  isSavingTeam.value = true
  formErrors.value = {}

  try {
    const updatedInstallation = await McpInstallationService.updateTeamArgs(
      props.teamId,
      props.installation.id,
      pendingTeamChanges.value
    )

    pendingTeamChanges.value = []
    emit('installation-updated', updatedInstallation)
    toast.success('Team arguments updated', {
      description: 'Server is restarting with new configuration...'
    })
  } catch (error) {
    toast.error('Failed to update team arguments', {
      description: error instanceof Error ? error.message : 'An error occurred'
    })
  } finally {
    isSavingTeam.value = false
  }
}

const saveUserChanges = async () => {
  if (!hasUserChanges.value) return

  isSavingUser.value = true
  formErrors.value = {}

  try {
    if (!props.currentUserConfig) {
      const createData = {
        installation_id: props.installation.id,
        user_args: pendingUserChanges.value
      }
      const newConfig = await McpInstallationService.createUserConfiguration(
        props.teamId,
        props.installation.id,
        createData
      )
      emit('configuration-updated', newConfig)
    } else {
      const updatedConfig = await McpInstallationService.updateUserConfiguration(
        props.teamId,
        props.installation.id,
        props.currentUserConfig.id,
        { user_args: pendingUserChanges.value }
      )
      emit('configuration-updated', updatedConfig)
    }

    pendingUserChanges.value = {}
    toast.success('Your arguments updated', {
      description: 'Server is restarting with new configuration...'
    })
  } catch (error) {
    toast.error('Failed to update user arguments', {
      description: error instanceof Error ? error.message : 'An error occurred'
    })
  } finally {
    isSavingUser.value = false
  }
}

const openRemoveDialog = (name: string) => {
  removingItemName.value = name
  isRemoveDialogOpen.value = true
}

const confirmRemove = async () => {
  isRemoving.value = true
  try {
    await McpInstallationService.updateConfigSchema(
      props.teamId,
      props.installation.id,
      {
        action: 'remove',
        config_type: 'args',
        item_name: removingItemName.value
      }
    )
    toast.success(t('mcpInstallations.configSchema.remove.success.removed'), {
      description: t('mcpInstallations.configSchema.remove.success.removedDescription', { name: removingItemName.value })
    })
    isRemoveDialogOpen.value = false
    emit('config-removed')
  } catch (error) {
    toast.error(t('mcpInstallations.configSchema.remove.error.removeFailed'), {
      description: error instanceof Error ? error.message : 'An error occurred'
    })
  } finally {
    isRemoving.value = false
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
            <Button
              v-if="isGithubDeployment && canEdit && arg.name"
              size="sm"
              variant="ghost"
              class="text-destructive hover:text-destructive"
              @click="openRemoveDialog(arg.name)"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </li>
      </ul>

    <template #footer-actions>
      <Button
        :disabled="!hasTeamChanges || isSavingTeam"
        @click="saveTeamChanges"
      >
        <Spinner v-if="isSavingTeam" class="mr-2" />
        Save & Restart
      </Button>
    </template>
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

    <template #footer-actions>
      <Button
        :disabled="!hasUserChanges || isSavingUser"
        @click="saveUserChanges"
      >
        <Spinner v-if="isSavingUser" class="mr-2" />
        Save & Restart
      </Button>
    </template>
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

            <!-- Boolean select -->
            <Select
              v-if="editingItem && isBoolean(editingItem)"
              v-model="editingValue"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">false</SelectItem>
                <SelectItem value="true">true</SelectItem>
              </SelectContent>
            </Select>

            <!-- Textarea for long values -->
            <div v-else-if="editingItem && isTextarea(editingItem)" class="relative">
              <Textarea
                id="config-value"
                v-model="editingValue"
                :placeholder="editingItem.placeholder || 'Enter value'"
                class="min-h-[100px]"
                :class="{ 'border-destructive': formErrors.value }"
                :required="editingItem.required"
              />
            </div>

            <!-- Regular input -->
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
              Apply
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Remove Confirmation Dialog -->
    <AlertDialog :open="isRemoveDialogOpen" @update:open="(value) => isRemoveDialogOpen = value">
      <AlertDialogContent class="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('mcpInstallations.configSchema.remove.confirmTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('mcpInstallations.configSchema.remove.confirmDescription', { name: removingItemName }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" @click="isRemoveDialogOpen = false">
            {{ t('mcpInstallations.configSchema.remove.cancelButton') }}
          </Button>
          <Button variant="destructive" :disabled="isRemoving" @click="confirmRemove">
            <Spinner v-if="isRemoving" class="mr-2" />
            {{ t('mcpInstallations.configSchema.remove.confirmButton') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
</template>
