<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Settings, Eye, EyeOff, Plus, Trash2 } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { Button } from '@/components/ui/button'
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
  teamId: string
  canEdit?: boolean
  userRole?: 'team_admin' | 'team_user' | null
}

const props = withDefaults(defineProps<Props>(), {
  canEdit: true,
  userRole: null
})

// Emits
const emit = defineEmits<{
  'configuration-updated': [config: UserConfiguration]
}>()

const { t } = useI18n()

// Server data
const serverData = ref<any>(null)
const isLoadingServer = ref(true)

// User configurations
const userConfigurations = ref<UserConfiguration[]>([])
const currentUserConfig = ref<UserConfiguration | null>(null)
const isLoadingUserConfig = ref(true)

// Modal state
const isEditModalOpen = ref(false)
const isCreateModalOpen = ref(false)
const editingItem = ref<any>(null)
const editingValue = ref('')
const editingType = ref<'arg' | 'env'>('env')
const showPassword = ref(false)
const isSubmitting = ref(false)
const formErrors = ref<Record<string, string>>({})

// Device name for new configurations
const deviceName = ref('')

// Load server data and user configurations
onMounted(async () => {
  try {
    isLoadingServer.value = true
    isLoadingUserConfig.value = true
    
    // Load server schema data
    if (props.installation.server_id) {
      serverData.value = await McpCatalogService.getServerById(props.installation.server_id)
    }
    
    // Load user configurations
    await loadUserConfigurations()
  } catch (error) {
    console.error('Error loading data:', error)
  } finally {
    isLoadingServer.value = false
    isLoadingUserConfig.value = false
  }
})

// Load user configurations
const loadUserConfigurations = async () => {
  try {
    const configs: UserConfiguration[] = await McpInstallationService.getUserConfigurations(
      props.teamId,
      props.installation.id
    )
    userConfigurations.value = configs
    
    // Set current config (first one for now, could be device-specific later)
    if (configs.length > 0 && configs[0]) {
      currentUserConfig.value = configs[0]
    } else {
      currentUserConfig.value = null
    }
  } catch (error) {
    console.error('Error loading user configurations:', error)
    userConfigurations.value = []
    currentUserConfig.value = null
  }
}

// Parse user schemas from server data
const userArgsSchema = computed(() => {
  const schema = props.installation.server?.user_args_schema || serverData.value?.user_args_schema
  if (!schema) return []
  try {
    return Array.isArray(schema) ? schema : JSON.parse(schema)
  } catch {
    return []
  }
})

const userEnvSchema = computed(() => {
  const schema = props.installation.server?.user_env_schema || serverData.value?.user_env_schema
  if (!schema) return []
  try {
    return Array.isArray(schema) ? schema : JSON.parse(schema)
  } catch {
    return []
  }
})

// Get current user configuration values
const currentUserArgs = computed(() => {
  return currentUserConfig.value?.user_args || []
})

const currentUserEnv = computed(() => {
  return currentUserConfig.value?.user_env || {}
})

// Prepare user arguments with current values
const userArgsWithData = computed(() => {
  return userArgsSchema.value.map((argSchema: any, index: number) => ({
    ...argSchema,
    index,
    currentValue: currentUserArgs.value[index] || ''
  }))
})

// Prepare user environment variables with current values
const userEnvWithData = computed(() => {
  return userEnvSchema.value.map((envSchema: any) => ({
    ...envSchema,
    currentValue: currentUserEnv.value[envSchema.name] || ''
  }))
})

// Check if there's any user configuration schema
const hasUserConfiguration = computed(() => {
  return userArgsSchema.value.length > 0 || userEnvSchema.value.length > 0
})

// Check if user has configuration data
const hasUserConfigData = computed(() => {
  return currentUserConfig.value !== null
})

// Check if loading
const isLoading = computed(() => {
  return isLoadingServer.value || isLoadingUserConfig.value
})

// Modal functions
const openEditModal = (item: any, type: 'arg' | 'env') => {
  if (!props.canEdit) return
  
  editingItem.value = item
  editingType.value = type
  editingValue.value = item.currentValue
  showPassword.value = false
  formErrors.value = {}
  isEditModalOpen.value = true
}

const openCreateModal = () => {
  if (!props.canEdit) return
  
  deviceName.value = ''
  formErrors.value = {}
  isCreateModalOpen.value = true
}

const closeEditModal = () => {
  isEditModalOpen.value = false
  editingItem.value = null
  editingValue.value = ''
  editingType.value = 'env'
  showPassword.value = false
  formErrors.value = {}
}

const closeCreateModal = () => {
  isCreateModalOpen.value = false
  deviceName.value = ''
  formErrors.value = {}
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

const getInputType = (item: any) => {
  if (item.type === 'password' && !showPassword.value) {
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
    errors.value = t('mcpInstallations.userConfiguration.editModal.validation.required')
  }
  
  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const validateCreateForm = () => {
  const errors: Record<string, string> = {}
  
  if (!deviceName.value.trim()) {
    errors.deviceName = t('mcpInstallations.userConfiguration.createModal.validation.deviceNameRequired')
  }
  
  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const handleEdit = async () => {
  if (!validateForm() || !currentUserConfig.value) return
  
  isSubmitting.value = true
  
  try {
    let updatedArgs = [...currentUserArgs.value]
    let updatedEnv = { ...currentUserEnv.value }
    
    if (editingType.value === 'arg') {
      updatedArgs[editingItem.value.index] = editingValue.value
    } else {
      updatedEnv[editingItem.value.name] = editingValue.value
    }
    
    const updatedConfig: UserConfiguration = await McpInstallationService.updateUserConfiguration(
      props.teamId,
      props.installation.id,
      currentUserConfig.value.id,
      {
        device_name: currentUserConfig.value.device_name,
        user_args: updatedArgs,
        user_env: updatedEnv
      }
    )
    
    currentUserConfig.value = updatedConfig
    emit('configuration-updated', updatedConfig)
    
    const itemName = editingType.value === 'arg' 
      ? t('mcpInstallations.userConfiguration.table.values.argumentNumber', { number: editingItem.value.index + 1 })
      : editingItem.value.name
    
    toast.success(t('mcpInstallations.userConfiguration.editModal.success.updated', { item: itemName }), {
      description: t('mcpInstallations.userConfiguration.editModal.success.description')
    })
    
    closeEditModal()
  } catch (error) {
    console.error('Error updating user configuration:', error)
    formErrors.value.general = error instanceof Error ? error.message : t('mcpInstallations.userConfiguration.editModal.errors.updateFailed')
  } finally {
    isSubmitting.value = false
  }
}

const handleCreate = async () => {
  if (!validateCreateForm()) return
  
  isSubmitting.value = true
  
  try {
    // Initialize with empty arrays/objects based on schema
    const initialArgs = new Array(userArgsSchema.value.length).fill('')
    const initialEnv: Record<string, string> = {}
    
    userEnvSchema.value.forEach((envSchema: any) => {
      initialEnv[envSchema.name] = ''
    })
    
    const newConfig: UserConfiguration = await McpInstallationService.createUserConfiguration(
      props.teamId,
      props.installation.id,
      {
        device_name: deviceName.value.trim(),
        user_args: initialArgs,
        user_env: initialEnv
      }
    )
    
    currentUserConfig.value = newConfig
    userConfigurations.value.push(newConfig)
    emit('configuration-updated', newConfig)
    
    toast.success(t('mcpInstallations.userConfiguration.createModal.success.created'), {
      description: t('mcpInstallations.userConfiguration.createModal.success.description')
    })
    
    closeCreateModal()
  } catch (error) {
    console.error('Error creating user configuration:', error)
    formErrors.value.general = error instanceof Error ? error.message : t('mcpInstallations.userConfiguration.createModal.errors.createFailed')
  } finally {
    isSubmitting.value = false
  }
}

const modalTitle = computed(() => {
  if (!editingItem.value) return ''
  
  if (editingType.value === 'arg') {
    return t('mcpInstallations.userConfiguration.editModal.titleArg', { number: editingItem.value.index + 1 })
  } else {
    return t('mcpInstallations.userConfiguration.editModal.titleEnv', { name: editingItem.value.name })
  }
})
</script>

<template>
  <div>
    <div class="px-4 sm:px-0 border-b border-gray-200 pb-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpInstallations.userConfiguration.title') }}</h3>
          <p class="mt-1 text-sm/6 text-gray-500">
            {{ t('mcpInstallations.userConfiguration.description') }}
          </p>
        </div>
        <div v-if="hasUserConfiguration && !hasUserConfigData && props.canEdit" class="flex items-center">
          <Button @click="openCreateModal" class="flex items-center gap-2">
            <Plus class="h-4 w-4" />
            {{ t('mcpInstallations.userConfiguration.actions.createConfiguration') }}
          </Button>
        </div>
      </div>
    </div>

    <div class="mt-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="px-4 py-12 sm:px-0 text-center">
        <div class="text-muted-foreground">{{ t('mcpInstallations.userConfiguration.loading') }}</div>
      </div>

      <!-- User Configuration Content -->
      <div v-else-if="hasUserConfiguration" class="space-y-8">
        <!-- Configuration Status -->
        <div v-if="hasUserConfigData" class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center gap-2 text-green-800">
            <Settings class="h-4 w-4" />
            <span class="font-medium">{{ t('mcpInstallations.userConfiguration.status.configured') }}</span>
            <Badge v-if="currentUserConfig?.device_name" variant="outline" class="ml-2">
              {{ currentUserConfig.device_name }}
            </Badge>
          </div>
          <p class="text-sm text-green-600 mt-1">
            {{ t('mcpInstallations.userConfiguration.status.description') }}
          </p>
        </div>

        <!-- User Arguments Section -->
        <div v-if="userArgsSchema.length > 0">
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-900">{{ t('mcpInstallations.userConfiguration.sections.userArgs.title') }}</h4>
            <p class="text-xs text-gray-500">{{ t('mcpInstallations.userConfiguration.sections.userArgs.description') }}</p>
          </div>

          <ul role="list" class="space-y-3">
            <li v-for="arg in userArgsWithData" :key="arg.index" class="flex items-center justify-between gap-x-6 py-5 bg-muted/50 rounded-lg px-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-start gap-x-3">
                  <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                    {{ t('mcpInstallations.userConfiguration.table.values.argumentNumber', { number: arg.index + 1 }) }}
                  </p>
                </div>
                <div class="mt-1 text-xs/5 text-gray-700">
                  <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.required') }}</span>
                  <span class="ml-1">{{ arg.required ? t('common.labels.yes') : t('common.labels.no') }}</span>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="space-y-1 text-xs/5 text-gray-700">
                  <div v-if="arg.type">
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.type') }}</span>
                    <span class="ml-1">{{ arg.type }}</span>
                  </div>
                  <div v-if="arg.description">
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.description') }}</span>
                    <span class="ml-1">{{ arg.description }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.value') }}</span>
                    <span class="ml-1 font-mono">
                      {{ arg.currentValue || t('mcpInstallations.userConfiguration.table.values.notSet') }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex flex-none items-center gap-x-4">
                <Button
                  v-if="canEdit && hasUserConfigData"
                  size="sm"
                  variant="outline"
                  @click="openEditModal(arg, 'arg')"
                >
                  {{ t('mcpInstallations.userConfiguration.table.actions.editValue') }}
                </Button>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  disabled
                  class="cursor-not-allowed opacity-50"
                >
                  {{ t('mcpInstallations.userConfiguration.table.actions.editValue') }}
                </Button>
              </div>
            </li>
          </ul>
        </div>

        <!-- User Environment Variables Section -->
        <div v-if="userEnvSchema.length > 0">
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-900">{{ t('mcpInstallations.userConfiguration.sections.userEnv.title') }}</h4>
            <p class="text-xs text-gray-500">{{ t('mcpInstallations.userConfiguration.sections.userEnv.description') }}</p>
          </div>

          <ul role="list" class="space-y-3">
            <li v-for="envVar in userEnvWithData" :key="envVar.name" class="flex items-center justify-between gap-x-6 py-5 bg-muted/50 rounded-lg px-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-start gap-x-3">
                  <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                    {{ envVar.name }}
                  </p>
                </div>
                <div class="mt-1 text-xs/5 text-gray-700">
                  <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.required') }}</span>
                  <span class="ml-1">{{ envVar.required ? t('common.labels.yes') : t('common.labels.no') }}</span>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="space-y-1 text-xs/5 text-gray-700">
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.type') }}</span>
                    <span class="ml-1">{{ envVar.type || t('mcpInstallations.userConfiguration.table.labels.defaultType') }}</span>
                  </div>
                  <div v-if="envVar.description">
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.description') }}</span>
                    <span class="ml-1">{{ envVar.description }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.value') }}</span>
                    <span v-if="envVar.type === 'password'" class="ml-1 font-mono">
                      {{ envVar.currentValue ? '••••••••' : t('mcpInstallations.userConfiguration.table.values.notSet') }}
                    </span>
                    <span v-else class="ml-1 font-mono">
                      {{ envVar.currentValue || t('mcpInstallations.userConfiguration.table.values.notSet') }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex flex-none items-center gap-x-4">
                <Button
                  v-if="canEdit && hasUserConfigData"
                  size="sm"
                  variant="outline"
                  @click="openEditModal(envVar, 'env')"
                >
                  {{ t('mcpInstallations.userConfiguration.table.actions.editValue') }}
                </Button>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  disabled
                  class="cursor-not-allowed opacity-50"
                >
                  {{ t('mcpInstallations.userConfiguration.table.actions.editValue') }}
                </Button>
              </div>
            </li>
          </ul>
        </div>

        <!-- No Configuration State -->
        <div v-if="!hasUserConfigData" class="px-4 py-8 sm:px-0 text-center border border-dashed border-gray-300 rounded-lg">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
            <Settings class="h-6 w-6 text-blue-600" />
          </div>
          <h3 class="text-sm font-medium text-gray-900 mb-2">{{ t('mcpInstallations.userConfiguration.noConfig.title') }}</h3>
          <p class="text-sm text-gray-500 max-w-sm mx-auto mb-4">
            {{ t('mcpInstallations.userConfiguration.noConfig.description') }}
          </p>
          <Button v-if="props.canEdit" @click="openCreateModal" class="flex items-center gap-2 mx-auto">
            <Plus class="h-4 w-4" />
            {{ t('mcpInstallations.userConfiguration.actions.createConfiguration') }}
          </Button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="px-4 py-12 sm:px-0 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
          <Settings class="h-6 w-6 text-gray-400" />
        </div>
        <h3 class="text-sm font-medium text-gray-900 mb-2">{{ t('mcpInstallations.userConfiguration.emptyState.title') }}</h3>
        <p class="text-sm text-gray-500 max-w-sm mx-auto">
          {{ t('mcpInstallations.userConfiguration.emptyState.description') }}
        </p>
      </div>
    </div>

    <!-- Edit Modal -->
    <AlertDialog :open="isEditModalOpen" @update:open="(value) => isEditModalOpen = value">
      <AlertDialogContent class="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ modalTitle }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('mcpInstallations.userConfiguration.editModal.description') }}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form @submit.prevent="handleEdit" class="space-y-4">
          <!-- Item Info -->
          <div v-if="editingItem" class="bg-gray-50 rounded-lg p-4 space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">
                {{ editingType === 'arg' ? t('mcpInstallations.userConfiguration.editModal.form.labels.argument') : t('mcpInstallations.userConfiguration.editModal.form.labels.variable') }}
              </span>
              <code class="bg-gray-200 text-gray-800 px-2 py-1 rounded font-mono text-xs font-semibold">
                {{ editingType === 'arg' ? t('mcpInstallations.userConfiguration.table.values.argumentNumber', { number: editingItem.index + 1 }) : editingItem.name }}
              </code>
              <Badge v-if="editingItem.required" variant="default" class="text-xs">
                {{ t('mcpInstallations.userConfiguration.table.values.required') }}
              </Badge>
            </div>
            <div v-if="editingItem.description" class="text-sm text-gray-600">
              {{ editingItem.description }}
            </div>
          </div>

          <!-- General Error -->
          <div v-if="formErrors.general" class="text-sm text-destructive">
            {{ formErrors.general }}
          </div>

          <!-- Value Input -->
          <div class="space-y-2">
            <Label for="config-value">{{ t('mcpInstallations.userConfiguration.editModal.form.labels.userValue') }}</Label>

            <!-- Textarea for long values -->
            <div v-if="editingItem && isTextarea(editingItem)" class="relative">
              <Textarea
                id="config-value"
                v-model="editingValue"
                :placeholder="editingItem.placeholder || t('mcpInstallations.userConfiguration.editModal.form.placeholders.enterValue')"
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
                :placeholder="editingItem?.placeholder || t('mcpInstallations.userConfiguration.editModal.form.placeholders.enterValue')"
                :class="{ 'border-destructive': formErrors.value }"
                :required="editingItem?.required"
              />

              <!-- Password toggle -->
              <Button
                v-if="editingItem?.type === 'password'"
                type="button"
                variant="ghost"
                size="sm"
                class="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                @click="togglePasswordVisibility"
              >
                <span class="sr-only">
                  {{ showPassword ? t('mcpInstallations.userConfiguration.editModal.form.actions.hideValue') : t('mcpInstallations.userConfiguration.editModal.form.actions.showValue') }}
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
              {{ t('mcpInstallations.userConfiguration.editModal.form.buttons.cancel') }}
            </Button>
            <Button type="submit" :disabled="isSubmitting">
              {{ isSubmitting ? t('mcpInstallations.userConfiguration.editModal.form.buttons.saving') : t('mcpInstallations.userConfiguration.editModal.form.buttons.save') }}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Create Configuration Modal -->
    <AlertDialog :open="isCreateModalOpen" @update:open="(value) => isCreateModalOpen = value">
      <AlertDialogContent class="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('mcpInstallations.userConfiguration.createModal.title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('mcpInstallations.userConfiguration.createModal.description') }}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form @submit.prevent="handleCreate" class="space-y-4">
          <!-- General Error -->
          <div v-if="formErrors.general" class="text-sm text-destructive">
            {{ formErrors.general }}
          </div>

          <!-- Device Name Input -->
          <div class="space-y-2">
            <Label for="device-name">{{ t('mcpInstallations.userConfiguration.createModal.form.labels.deviceName') }}</Label>
            <Input
              id="device-name"
              v-model="deviceName"
              :placeholder="t('mcpInstallations.userConfiguration.createModal.form.placeholders.deviceName')"
              :class="{ 'border-destructive': formErrors.deviceName }"
              required
            />
            <div v-if="formErrors.deviceName" class="text-sm text-destructive">
              {{ formErrors.deviceName }}
            </div>
            <p class="text-xs text-gray-500">
              {{ t('mcpInstallations.userConfiguration.createModal.form.help.deviceName') }}
            </p>
          </div>

          <AlertDialogFooter>
            <Button type="button" variant="outline" @click="closeCreateModal">
              {{ t('mcpInstallations.userConfiguration.createModal.form.buttons.cancel') }}
            </Button>
            <Button type="submit" :disabled="isSubmitting">
              {{ isSubmitting ? t('mcpInstallations.userConfiguration.createModal.form.buttons.creating') : t('mcpInstallations.userConfiguration.createModal.form.buttons.create') }}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
