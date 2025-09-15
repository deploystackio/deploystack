<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Settings, Eye, EyeOff, Edit } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

// Modal state for editing values
const isEditModalOpen = ref(false)
const editingItem = ref<any>(null)
const editingValue = ref('')
const editingType = ref<'arg' | 'env'>('env')
const showPassword = ref(false)
const isSubmitting = ref(false)
const formErrors = ref<Record<string, string>>({})

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

    // Set current config (first one for now)
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
  return (currentUserConfig.value?.user_args as Record<string, any>) || {}
})

const currentUserEnv = computed(() => {
  return (currentUserConfig.value?.user_env as Record<string, any>) || {}
})

// Prepare user arguments with current values
const userArgsWithData = computed(() => {
  return userArgsSchema.value.map((argSchema: any) => ({
    ...argSchema,
    currentValue: currentUserArgs.value[argSchema.name] || ''
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
  return isLoadingServer.value || isLoadingUserConfig.value
})

// Get current user configuration value for an item
const getUserValue = (item: any, type: 'arg' | 'env') => {
  if (!currentUserConfig.value) return ''

  if (type === 'arg') {
    return currentUserArgs.value[item.name] || ''
  } else {
    return currentUserEnv.value[item.name] || ''
  }
}

// Modal functions
const openEditModal = (item: any, type: 'arg' | 'env') => {
  editingItem.value = item
  editingType.value = type
  editingValue.value = getUserValue(item, type)
  showPassword.value = false
  formErrors.value = {}
  isEditModalOpen.value = true
}

const closeEditModal = () => {
  isEditModalOpen.value = false
  editingItem.value = null
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
    if (!currentUserConfig.value) {
      // Create new user configuration
      const createData: any = {}

      if (editingType.value === 'arg') {
        createData.user_args = {
          [editingItem.value.name]: editingValue.value
        }
      } else {
        createData.user_env = {
          [editingItem.value.name]: editingValue.value
        }
      }

      const newConfig = await McpInstallationService.createUserConfiguration(
        props.teamId,
        props.installation.id,
        createData
      )

      userConfigurations.value.push(newConfig)
      currentUserConfig.value = newConfig
    } else {
      // Update existing configuration
      const updateData: any = {}

      if (editingType.value === 'arg') {
        const updatedArgs = { ...(currentUserConfig.value.user_args as Record<string, any> || {}) }
        updatedArgs[editingItem.value.name] = editingValue.value
        updateData.user_args = updatedArgs
      } else {
        const updatedEnv = { ...(currentUserConfig.value.user_env as Record<string, any> || {}) }
        updatedEnv[editingItem.value.name] = editingValue.value
        updateData.user_env = updatedEnv
      }

      const updatedConfig = await McpInstallationService.updateUserConfiguration(
        props.teamId,
        props.installation.id,
        currentUserConfig.value.id,
        updateData
      )

      // Update local state
      const configIndex = userConfigurations.value.findIndex(c => c.id === currentUserConfig.value!.id)
      if (configIndex >= 0) {
        userConfigurations.value[configIndex] = updatedConfig
      }
      currentUserConfig.value = updatedConfig
    }

    emit('configuration-updated', currentUserConfig.value)

    // Show success toast
    toast.success(t('mcpInstallations.userConfiguration.editModal.messages.saveSuccess'), {
      description: t('mcpInstallations.userConfiguration.editModal.messages.saveSuccessDescription', {
        item: editingItem.value.name
      })
    })

    closeEditModal()
  } catch (error) {
    console.error('Error updating user configuration:', error)

    // Show error toast
    toast.error(t('mcpInstallations.userConfiguration.editModal.messages.saveError'), {
      description: error instanceof Error ? error.message : t('mcpInstallations.userConfiguration.editModal.messages.saveErrorDescription')
    })

    formErrors.value.general = error instanceof Error ? error.message : 'Failed to update configuration'
  } finally {
    isSubmitting.value = false
  }
}

const modalTitle = computed(() => {
  if (!editingItem.value) return ''

  const itemName = editingItem.value.name

  return t('mcpInstallations.userConfiguration.editModal.title', {
    item: itemName
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

        <!-- User Arguments Section -->
        <div v-if="userArgsSchema.length > 0">
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-900">{{ t('mcpInstallations.userConfiguration.sections.userArgs.title') }}</h4>
            <p class="text-xs text-gray-500">{{ t('mcpInstallations.userConfiguration.sections.userArgs.description') }}</p>
          </div>

          <div class="border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="text-xs">{{ t('mcpInstallations.userConfiguration.table.columns.name') }}</TableHead>
                  <TableHead class="text-xs">{{ t('mcpInstallations.userConfiguration.table.columns.type') }}</TableHead>
                  <TableHead class="text-xs">{{ t('mcpInstallations.userConfiguration.table.columns.required') }}</TableHead>
                  <TableHead class="text-xs">{{ t('mcpInstallations.userConfiguration.table.columns.value') }}</TableHead>
                  <TableHead class="text-xs w-24">{{ t('mcpInstallations.userConfiguration.table.columns.actions') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="arg in userArgsWithData" :key="arg.name">
                  <TableCell class="text-xs">
                    <div class="font-mono font-semibold">{{ arg.name }}</div>
                    <div v-if="arg.description" class="text-gray-500 text-xs mt-1">{{ arg.description }}</div>
                  </TableCell>
                  <TableCell class="text-xs">{{ arg.type || 'string' }}</TableCell>
                  <TableCell class="text-xs">
                    <Badge v-if="arg.required" variant="default" class="text-xs">{{ t('common.labels.yes') }}</Badge>
                    <span v-else class="text-gray-500">{{ t('common.labels.no') }}</span>
                  </TableCell>
                  <TableCell class="text-xs font-mono">
                    {{ arg.currentValue || t('mcpInstallations.userConfiguration.table.values.notSet') }}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      class="h-7 text-xs"
                      @click="openEditModal(arg, 'arg')"
                    >
                      <Edit class="h-3 w-3 mr-1" />
                      {{ t('mcpInstallations.userConfiguration.table.actions.edit') }}
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <!-- User Environment Variables Section -->
        <div v-if="userEnvSchema.length > 0">
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-900">{{ t('mcpInstallations.userConfiguration.sections.userEnv.title') }}</h4>
            <p class="text-xs text-gray-500">{{ t('mcpInstallations.userConfiguration.sections.userEnv.description') }}</p>
          </div>

          <div class="border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="text-xs">{{ t('mcpInstallations.userConfiguration.table.columns.name') }}</TableHead>
                  <TableHead class="text-xs">{{ t('mcpInstallations.userConfiguration.table.columns.type') }}</TableHead>
                  <TableHead class="text-xs">{{ t('mcpInstallations.userConfiguration.table.columns.required') }}</TableHead>
                  <TableHead class="text-xs">{{ t('mcpInstallations.userConfiguration.table.columns.value') }}</TableHead>
                  <TableHead class="text-xs w-24">{{ t('mcpInstallations.userConfiguration.table.columns.actions') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="envVar in userEnvWithData" :key="envVar.name">
                  <TableCell class="text-xs">
                    <div class="font-mono font-semibold">{{ envVar.name }}</div>
                    <div v-if="envVar.description" class="text-gray-500 text-xs mt-1">{{ envVar.description }}</div>
                  </TableCell>
                  <TableCell class="text-xs">{{ envVar.type || 'string' }}</TableCell>
                  <TableCell class="text-xs">
                    <Badge v-if="envVar.required" variant="default" class="text-xs">{{ t('common.labels.yes') }}</Badge>
                    <span v-else class="text-gray-500">{{ t('common.labels.no') }}</span>
                  </TableCell>
                  <TableCell class="text-xs font-mono">
                    <span v-if="envVar.type === 'password'">
                      {{ envVar.currentValue ? '••••••••' : t('mcpInstallations.userConfiguration.table.values.notSet') }}
                    </span>
                    <span v-else>
                      {{ envVar.currentValue || t('mcpInstallations.userConfiguration.table.values.notSet') }}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      class="h-7 text-xs"
                      @click="openEditModal(envVar, 'env')"
                    >
                      <Edit class="h-3 w-3 mr-1" />
                      {{ t('mcpInstallations.userConfiguration.table.actions.edit') }}
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
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
                {{ editingItem.name }}
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
            <Button
              type="submit"
              :loading="isSubmitting"
              :loadingText="t('mcpInstallations.userConfiguration.editModal.form.buttons.saving')"
            >
              {{ t('mcpInstallations.userConfiguration.editModal.form.buttons.save') }}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
