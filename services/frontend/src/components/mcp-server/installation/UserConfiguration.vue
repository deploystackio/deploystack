<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings, Eye, EyeOff, AlertTriangle, Monitor } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { DeviceService } from '@/services/deviceService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { McpInstallation, UserConfiguration } from '@/types/mcp-installations'
import type { Device } from '@/views/devices/types'

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

// Device data
const devices = ref<Device[]>([])
const isLoadingDevices = ref(true)

// Modal state for editing values
const isEditModalOpen = ref(false)
const editingDevice = ref<any>(null)
const editingItem = ref<any>(null)
const editingValue = ref('')
const editingType = ref<'arg' | 'env'>('env')
const showPassword = ref(false)
const isSubmitting = ref(false)
const formErrors = ref<Record<string, string>>({})

// Device API endpoint: /api/users/me/devices - to list all user devices

// Load user devices using DeviceService
const loadUserDevices = async () => {
  try {
    isLoadingDevices.value = true
    devices.value = await DeviceService.getAllDevices()
  } catch (error) {
    console.error('Error loading user devices:', error)
    devices.value = []
  } finally {
    isLoadingDevices.value = false
  }
}

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
    
    // Load user devices
    await loadUserDevices()
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

// Check if loading
const isLoading = computed(() => {
  return isLoadingServer.value || isLoadingUserConfig.value || isLoadingDevices.value
})

// Check if user has any devices
const hasDevices = computed(() => {
  return devices.value.length > 0
})

// Get device-specific value for an item
const getDeviceValue = (item: any, deviceId: string, type: 'arg' | 'env') => {
  const userConfig = userConfigurations.value.find(config => config.device_id === deviceId)
  if (!userConfig) return ''
  
  if (type === 'arg') {
    return userConfig.user_args?.[item.index] || ''
  } else {
    return userConfig.user_env?.[item.name] || ''
  }
}

// Modal functions
const openEditModal = (item: any, device: any, type: 'arg' | 'env') => {
  editingItem.value = item
  editingDevice.value = device
  editingType.value = type
  editingValue.value = getDeviceValue(item, device.id, type)
  showPassword.value = false
  formErrors.value = {}
  isEditModalOpen.value = true
}

const closeEditModal = () => {
  isEditModalOpen.value = false
  editingItem.value = null
  editingDevice.value = null
  editingValue.value = ''
  editingType.value = 'env'
  showPassword.value = false
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

const handleEdit = async () => {
  if (!validateForm()) return
  
  isSubmitting.value = true
  
  try {
    // Find existing user config for this device or create new one
    let userConfig = userConfigurations.value.find(config => config.device_id === editingDevice.value.id)
    
    if (!userConfig) {
      // Create new user configuration for this device
      const initialArgs = new Array(userArgsSchema.value.length).fill('')
      const initialEnv: Record<string, string> = {}
      
      userConfig = await McpInstallationService.createUserConfiguration(
        props.teamId,
        props.installation.id,
        {
          device_id: editingDevice.value.id,
          user_args: initialArgs,
          user_env: initialEnv
        }
      )
      
      userConfigurations.value.push(userConfig)
    }
    
    // Update the specific field
    let updatedArgs = [...(userConfig.user_args || [])]
    let updatedEnv = { ...(userConfig.user_env || {}) }
    
    if (editingType.value === 'arg') {
      // Ensure array is large enough
      while (updatedArgs.length <= editingItem.value.index) {
        updatedArgs.push('')
      }
      updatedArgs[editingItem.value.index] = editingValue.value
    } else {
      updatedEnv[editingItem.value.name] = editingValue.value
    }
    
    // Update the configuration
    const updatedConfig = await McpInstallationService.updateUserConfiguration(
      props.teamId,
      props.installation.id,
      userConfig.id,
      {
        device_id: editingDevice.value.id,
        user_args: updatedArgs,
        user_env: updatedEnv
      }
    )
    
    // Update local state
    const configIndex = userConfigurations.value.findIndex(c => c.id === userConfig!.id)
    if (configIndex >= 0) {
      userConfigurations.value[configIndex] = updatedConfig
    }
    
    emit('configuration-updated', updatedConfig)
    
    closeEditModal()
  } catch (error) {
    console.error('Error updating user configuration:', error)
    formErrors.value.general = error instanceof Error ? error.message : 'Failed to update configuration'
  } finally {
    isSubmitting.value = false
  }
}

const modalTitle = computed(() => {
  if (!editingItem.value || !editingDevice.value) return ''
  
  const itemName = editingType.value === 'arg' 
    ? t('mcpInstallations.userConfiguration.table.values.argumentNumber', { number: editingItem.value.index + 1 })
    : editingItem.value.name
    
  return t('mcpInstallations.userConfiguration.editModal.title', { 
    item: itemName, 
    device: editingDevice.value.device_name 
  })
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
      </div>
    </div>

    <div class="mt-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="px-4 py-12 sm:px-0 text-center">
        <div class="text-muted-foreground">{{ t('mcpInstallations.userConfiguration.loading') }}</div>
      </div>

      <!-- User Configuration Content -->
      <div v-else-if="hasUserConfiguration" class="space-y-8">
        <!-- Warning if no devices -->
        <Alert v-if="!hasDevices" class="border-orange-200 bg-orange-50">
          <AlertTriangle class="h-4 w-4 text-orange-600" />
          <AlertDescription class="text-orange-800">
            <strong>{{ t('mcpInstallations.userConfiguration.noDevices.title') }}</strong><br>
            {{ t('mcpInstallations.userConfiguration.noDevices.description') }}
          </AlertDescription>
        </Alert>

        <!-- User Arguments Section -->
        <div v-if="userArgsSchema.length > 0">
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-900">{{ t('mcpInstallations.userConfiguration.sections.userArgs.title') }}</h4>
            <p class="text-xs text-gray-500">{{ t('mcpInstallations.userConfiguration.sections.userArgs.description') }}</p>
          </div>

          <ul role="list" class="space-y-3">
            <li v-for="arg in userArgsWithData" :key="arg.index" class="bg-muted/50 rounded-lg px-4 py-5">
              <div class="flex items-center justify-between gap-x-6 mb-4">
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
              </div>
              
              <!-- Device-specific values table -->
              <div v-if="hasDevices" class="w-full">
                <h5 class="text-xs font-medium text-gray-800 mb-2">{{ t('mcpInstallations.userConfiguration.deviceTable.title') }}</h5>
                <div class="border rounded-md bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead class="text-xs">{{ t('mcpInstallations.userConfiguration.deviceTable.deviceName') }}</TableHead>
                        <TableHead class="text-xs">{{ t('mcpInstallations.userConfiguration.deviceTable.value') }}</TableHead>
                        <TableHead class="text-xs w-24">{{ t('mcpInstallations.userConfiguration.deviceTable.actions') }}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="device in devices" :key="device.id">
                        <TableCell class="text-xs">
                          <div class="flex items-center gap-2">
                            <Monitor class="h-3 w-3 text-muted-foreground" />
                            <span>{{ device.device_name }}</span>
                          </div>
                        </TableCell>
                        <TableCell class="text-xs font-mono">
                          {{ getDeviceValue(arg, device.id, 'arg') || t('mcpInstallations.userConfiguration.table.values.notSet') }}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            class="h-7 text-xs"
                            @click="openEditModal(arg, device, 'arg')"
                          >
                            {{ t('mcpInstallations.userConfiguration.deviceTable.changeValue') }}
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
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
            <li v-for="envVar in userEnvWithData" :key="envVar.name" class="bg-muted/50 rounded-lg px-4 py-5">
              <div class="flex items-center justify-between gap-x-6 mb-4">
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
              </div>
              
              <!-- Device-specific values table -->
              <div v-if="hasDevices" class="w-full">
                <h5 class="text-xs font-medium text-gray-800 mb-2">{{ t('mcpInstallations.userConfiguration.deviceTable.title') }}</h5>
                <div class="border rounded-md bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead class="text-xs">{{ t('mcpInstallations.userConfiguration.deviceTable.deviceName') }}</TableHead>
                        <TableHead class="text-xs">{{ t('mcpInstallations.userConfiguration.deviceTable.value') }}</TableHead>
                        <TableHead class="text-xs w-24">{{ t('mcpInstallations.userConfiguration.deviceTable.actions') }}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="device in devices" :key="device.id">
                        <TableCell class="text-xs">
                          <div class="flex items-center gap-2">
                            <Monitor class="h-3 w-3 text-muted-foreground" />
                            <span>{{ device.device_name }}</span>
                          </div>
                        </TableCell>
                        <TableCell class="text-xs font-mono">
                          <span v-if="envVar.type === 'password'">
                            {{ getDeviceValue(envVar, device.id, 'env') ? '••••••••' : t('mcpInstallations.userConfiguration.table.values.notSet') }}
                          </span>
                          <span v-else>
                            {{ getDeviceValue(envVar, device.id, 'env') || t('mcpInstallations.userConfiguration.table.values.notSet') }}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            class="h-7 text-xs"
                            @click="openEditModal(envVar, device, 'env')"
                          >
                            {{ t('mcpInstallations.userConfiguration.deviceTable.changeValue') }}
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </li>
          </ul>
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
          <div v-if="editingItem && editingDevice" class="bg-gray-50 rounded-lg p-4 space-y-2">
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
            <div class="flex items-center gap-2">
              <Monitor class="h-4 w-4 text-gray-600" />
              <span class="text-sm text-gray-600">{{ editingDevice.device_name }}</span>
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
  </div>
</template>
