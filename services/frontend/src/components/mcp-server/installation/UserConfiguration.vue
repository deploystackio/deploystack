<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Settings, Eye, EyeOff } from 'lucide-vue-next'
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

// Modal state for editing values
const isEditModalOpen = ref(false)
const editingItem = ref<any>(null)
const editingValue = ref('')
const editingType = ref<'arg' | 'env' | 'header' | 'query_param'>('env')
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

const userHeadersSchema = computed(() => {
  const schema = props.installation.server?.user_headers_schema || serverData.value?.user_headers_schema
  if (!schema) return []
  try {
    return Array.isArray(schema) ? schema : JSON.parse(schema)
  } catch {
    return []
  }
})

const userQueryParamsSchema = computed(() => {
  const schema = props.installation.server?.user_url_query_params_schema || serverData.value?.user_url_query_params_schema
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

const currentUserHeaders = computed(() => {
  return (currentUserConfig.value?.user_headers as Record<string, any>) || {}
})

const currentUserQueryParams = computed(() => {
  return (currentUserConfig.value?.user_url_query_params as Record<string, any>) || {}
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

const userHeadersWithData = computed(() => {
  return userHeadersSchema.value.map((headerSchema: any) => ({
    ...headerSchema,
    currentValue: currentUserHeaders.value[headerSchema.name] || ''
  }))
})

const userQueryParamsWithData = computed(() => {
  return userQueryParamsSchema.value.map((queryParamSchema: any) => ({
    ...queryParamSchema,
    currentValue: currentUserQueryParams.value[queryParamSchema.name] || ''
  }))
})

// Check if there's any user configuration schema
const hasUserConfiguration = computed(() => {
  return userArgsSchema.value.length > 0 || userEnvSchema.value.length > 0 || userHeadersSchema.value.length > 0 || userQueryParamsSchema.value.length > 0
})

// Check if loading
const isLoading = computed(() => {
  return isLoadingServer.value || isLoadingUserConfig.value
})

// Get current user configuration value for an item
const getUserValue = (item: any, type: 'arg' | 'env' | 'header' | 'query_param') => {
  if (!currentUserConfig.value) return ''

  if (type === 'arg') {
    return currentUserArgs.value[item.name] || ''
  } else if (type === 'env') {
    return currentUserEnv.value[item.name] || ''
  } else if (type === 'header') {
    return currentUserHeaders.value[item.name] || ''
  } else {
    return currentUserQueryParams.value[item.name] || ''
  }
}

// Modal functions
const openEditModal = (item: any, type: 'arg' | 'env' | 'header' | 'query_param') => {
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
      } else if (editingType.value === 'env') {
        createData.user_env = {
          [editingItem.value.name]: editingValue.value
        }
      } else if (editingType.value === 'header') {
        createData.user_headers = {
          [editingItem.value.name]: editingValue.value
        }
      } else {
        createData.user_url_query_params = {
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
      // Update existing configuration using specific endpoints
      let updatedConfig: any

      if (editingType.value === 'arg') {
        const updatedArgs = { ...(currentUserConfig.value.user_args as Record<string, any> || {}) }
        updatedArgs[editingItem.value.name] = editingValue.value
        updatedConfig = await McpInstallationService.updateUserConfiguration(
          props.teamId,
          props.installation.id,
          currentUserConfig.value.id,
          { user_args: updatedArgs }
        )
      } else if (editingType.value === 'env') {
        const updatedEnv = { ...(currentUserConfig.value.user_env as Record<string, any> || {}) }
        updatedEnv[editingItem.value.name] = editingValue.value
        updatedConfig = await McpInstallationService.updateUserConfiguration(
          props.teamId,
          props.installation.id,
          currentUserConfig.value.id,
          { user_env: updatedEnv }
        )
      } else if (editingType.value === 'header') {
        const updatedHeaders = { ...(currentUserConfig.value.user_headers as Record<string, any> || {}) }
        updatedHeaders[editingItem.value.name] = editingValue.value
        updatedConfig = await McpInstallationService.updateUserHeaders(
          props.teamId,
          props.installation.id,
          currentUserConfig.value.id,
          updatedHeaders
        )
      } else {
        const updatedQueryParams = { ...(currentUserConfig.value.user_url_query_params as Record<string, any> || {}) }
        updatedQueryParams[editingItem.value.name] = editingValue.value
        updatedConfig = await McpInstallationService.updateUserQueryParams(
          props.teamId,
          props.installation.id,
          currentUserConfig.value.id,
          updatedQueryParams
        )
      }

      // Update local state
      const configIndex = userConfigurations.value.findIndex(c => c.id === currentUserConfig.value!.id)
      if (configIndex >= 0) {
        userConfigurations.value[configIndex] = updatedConfig
      }
      currentUserConfig.value = updatedConfig
    }

    if (currentUserConfig.value) {
      emit('configuration-updated', currentUserConfig.value)
    }

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
    <div>
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

          <ul role="list" class="space-y-3">
            <li v-for="arg in userArgsWithData" :key="arg.name" class="flex items-center justify-between gap-x-6 py-5 bg-white dark:bg-card border rounded-lg px-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-start gap-x-3">
                  <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                    {{ arg.name }}
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
                    <span v-if="arg.type === 'password' || arg.type === 'secret'" class="ml-1 font-mono">
                      {{ arg.currentValue ? '••••••••' : t('mcpInstallations.userConfiguration.table.values.notSet') }}
                    </span>
                    <span v-else class="ml-1 font-mono">
                      {{ arg.currentValue || t('mcpInstallations.userConfiguration.table.values.notSet') }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex flex-none items-center gap-x-4">
                <Button
                  size="sm"
                  variant="outline"
                  @click="openEditModal(arg, 'arg')"
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
            <li v-for="envVar in userEnvWithData" :key="envVar.name" class="flex items-center justify-between gap-x-6 py-5 bg-white dark:bg-card border rounded-lg px-4">
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
                    <span v-if="envVar.type === 'password' || envVar.type === 'secret'" class="ml-1 font-mono">
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
                  size="sm"
                  variant="outline"
                  @click="openEditModal(envVar, 'env')"
                >
                  {{ t('mcpInstallations.userConfiguration.table.actions.editValue') }}
                </Button>
              </div>
            </li>
          </ul>
        </div>

        <!-- User Headers Section -->
        <div v-if="userHeadersSchema.length > 0">
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-900">{{ t('mcpInstallations.userConfiguration.sections.userHeaders.title') }}</h4>
            <p class="text-xs text-gray-500">{{ t('mcpInstallations.userConfiguration.sections.userHeaders.description') }}</p>
          </div>

          <ul role="list" class="space-y-3">
            <li v-for="header in userHeadersWithData" :key="header.name" class="flex items-center justify-between gap-x-6 py-5 bg-white dark:bg-card border rounded-lg px-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-start gap-x-3">
                  <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                    {{ header.name }}
                  </p>
                </div>
                <div class="mt-1 text-xs/5 text-gray-700">
                  <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.required') }}</span>
                  <span class="ml-1">{{ header.required ? t('common.labels.yes') : t('common.labels.no') }}</span>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="space-y-1 text-xs/5 text-gray-700">
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.type') }}</span>
                    <span class="ml-1">{{ header.type || t('mcpInstallations.userConfiguration.table.labels.defaultType') }}</span>
                  </div>
                  <div v-if="header.description">
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.description') }}</span>
                    <span class="ml-1">{{ header.description }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.value') }}</span>
                    <span v-if="header.type === 'password' || header.type === 'secret'" class="ml-1 font-mono">
                      {{ header.currentValue ? '••••••••' : t('mcpInstallations.userConfiguration.table.values.notSet') }}
                    </span>
                    <span v-else class="ml-1 font-mono">
                      {{ header.currentValue || t('mcpInstallations.userConfiguration.table.values.notSet') }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex flex-none items-center gap-x-4">
                <Button
                  size="sm"
                  variant="outline"
                  @click="openEditModal(header, 'header')"
                >
                  {{ t('mcpInstallations.userConfiguration.table.actions.editValue') }}
                </Button>
              </div>
            </li>
          </ul>
        </div>

        <!-- User Query Parameters Section -->
        <div v-if="userQueryParamsSchema.length > 0">
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-900">{{ t('mcpInstallations.userConfiguration.sections.userQueryParams.title') }}</h4>
            <p class="text-xs text-gray-500">{{ t('mcpInstallations.userConfiguration.sections.userQueryParams.description') }}</p>
          </div>

          <ul role="list" class="space-y-3">
            <li v-for="queryParam in userQueryParamsWithData" :key="queryParam.name" class="flex items-center justify-between gap-x-6 py-5 bg-white dark:bg-card border rounded-lg px-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-start gap-x-3">
                  <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                    {{ queryParam.name }}
                  </p>
                </div>
                <div class="mt-1 text-xs/5 text-gray-700">
                  <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.required') }}</span>
                  <span class="ml-1">{{ queryParam.required ? t('common.labels.yes') : t('common.labels.no') }}</span>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="space-y-1 text-xs/5 text-gray-700">
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.type') }}</span>
                    <span class="ml-1">{{ queryParam.type || t('mcpInstallations.userConfiguration.table.labels.defaultType') }}</span>
                  </div>
                  <div v-if="queryParam.description">
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.description') }}</span>
                    <span class="ml-1">{{ queryParam.description }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.userConfiguration.table.labels.value') }}</span>
                    <span v-if="queryParam.type === 'password' || queryParam.type === 'secret'" class="ml-1 font-mono">
                      {{ queryParam.currentValue ? '••••••••' : t('mcpInstallations.userConfiguration.table.values.notSet') }}
                    </span>
                    <span v-else class="ml-1 font-mono">
                      {{ queryParam.currentValue || t('mcpInstallations.userConfiguration.table.values.notSet') }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex flex-none items-center gap-x-4">
                <Button
                  size="sm"
                  variant="outline"
                  @click="openEditModal(queryParam, 'query_param')"
                >
                  {{ t('mcpInstallations.userConfiguration.table.actions.editValue') }}
                </Button>
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
          <div v-if="editingItem" class="bg-gray-50 rounded-lg p-4 space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">
                {{ editingType === 'arg' ? t('mcpInstallations.userConfiguration.editModal.form.labels.argument') : editingType === 'env' ? t('mcpInstallations.userConfiguration.editModal.form.labels.variable') : editingType === 'header' ? t('mcpInstallations.userConfiguration.editModal.form.labels.header') : t('mcpInstallations.userConfiguration.editModal.form.labels.queryParam') }}
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
                v-if="editingItem?.type === 'password' || editingItem?.type === 'secret'"
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
