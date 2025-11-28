<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Settings, Eye, EyeOff } from 'lucide-vue-next'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { McpCatalogService } from '@/services/mcpCatalogService'
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
import type { McpInstallation } from '@/types/mcp-installations'

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
  'installation-updated': [installation: McpInstallation]
}>()

const { t } = useI18n()

// Server data
const serverData = ref<any>(null)
const isLoadingServer = ref(true)

// Modal state
const isEditModalOpen = ref(false)
const editingItem = ref<any>(null)
const editingValue = ref('')
const editingType = ref<'arg' | 'env' | 'header' | 'query_param'>('env')
const showPassword = ref(false)
const isSubmitting = ref(false)
const formErrors = ref<Record<string, string>>({})

// Load server data to get schemas
onMounted(async () => {
  try {
    isLoadingServer.value = true
    if (props.installation.server_id) {
      serverData.value = await McpCatalogService.getServerById(props.installation.server_id)
    }
  } catch (error) {
    console.error('Error loading server data:', error)
  } finally {
    isLoadingServer.value = false
  }
})

// Parse team schemas from server data (use installation.server first, fallback to serverData)
const teamArgsSchema = computed(() => {
  const schema = props.installation.server?.team_args_schema || serverData.value?.team_args_schema
  if (!schema) return []
  try {
    return Array.isArray(schema) ? schema : JSON.parse(schema)
  } catch {
    return []
  }
})

const teamEnvSchema = computed(() => {
  const schema = props.installation.server?.team_env_schema || serverData.value?.team_env_schema
  if (!schema) return []
  try {
    return Array.isArray(schema) ? schema : JSON.parse(schema)
  } catch {
    return []
  }
})

const teamHeadersSchema = computed(() => {
  const schema = props.installation.server?.team_headers_schema || serverData.value?.team_headers_schema
  if (!schema) return []
  try {
    return Array.isArray(schema) ? schema : JSON.parse(schema)
  } catch {
    return []
  }
})

const teamQueryParamsSchema = computed(() => {
  const schema = props.installation.server?.team_url_query_params_schema || serverData.value?.team_url_query_params_schema
  if (!schema) return []
  try {
    return Array.isArray(schema) ? schema : JSON.parse(schema)
  } catch {
    return []
  }
})

// Get current team configuration values
const currentTeamArgs = computed(() => {
  return props.installation.team_args || []
})

const currentTeamEnv = computed(() => {
  return props.installation.team_env || {}
})

const currentTeamHeaders = computed(() => {
  return props.installation.team_headers || {}
})

const currentTeamQueryParams = computed(() => {
  return props.installation.team_url_query_params || {}
})

// Prepare team arguments with current values
const teamArgsWithData = computed(() => {
  return teamArgsSchema.value.map((argSchema: any, index: number) => ({
    ...argSchema,
    index,
    currentValue: currentTeamArgs.value[index] || ''
  }))
})

// Prepare team environment variables with current values
const teamEnvWithData = computed(() => {
  return teamEnvSchema.value.map((envSchema: any) => ({
    ...envSchema,
    currentValue: currentTeamEnv.value[envSchema.name] || ''
  }))
})

// Prepare team headers with current values
const teamHeadersWithData = computed(() => {
  return teamHeadersSchema.value.map((headerSchema: any) => ({
    ...headerSchema,
    currentValue: currentTeamHeaders.value[headerSchema.name] || ''
  }))
})

// Prepare team query params with current values
const teamQueryParamsWithData = computed(() => {
  return teamQueryParamsSchema.value.map((paramSchema: any) => ({
    ...paramSchema,
    currentValue: currentTeamQueryParams.value[paramSchema.name] || ''
  }))
})

// Check if there's any team configuration
const hasTeamConfiguration = computed(() => {
  return teamArgsSchema.value.length > 0 || teamEnvSchema.value.length > 0 || teamHeadersSchema.value.length > 0 || teamQueryParamsSchema.value.length > 0
})

// Modal functions
const openEditModal = (item: any, type: 'arg' | 'env' | 'header' | 'query_param') => {
  if (!props.canEdit) return

  editingItem.value = item
  editingType.value = type
  editingValue.value = item.currentValue
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
    errors.value = t('mcpInstallations.teamConfiguration.editModal.validation.required')
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const handleSubmit = async () => {
  if (!validateForm()) return

  isSubmitting.value = true

  try {
    let updatedInstallation

    if (editingType.value === 'arg') {
      // Update team arguments
      const updatedArgs = [...currentTeamArgs.value]
      updatedArgs[editingItem.value.index] = editingValue.value

      updatedInstallation = await McpInstallationService.updateTeamArgs(
        props.teamId,
        props.installation.id,
        updatedArgs
      )
    } else if (editingType.value === 'header') {
      // Update team headers
      const updatedHeaders = {
        ...currentTeamHeaders.value,
        [editingItem.value.name]: editingValue.value
      }

      updatedInstallation = await McpInstallationService.updateTeamHeaders(
        props.teamId,
        props.installation.id,
        updatedHeaders
      )
    } else if (editingType.value === 'query_param') {
      // Update team query parameters
      const updatedQueryParams = {
        ...currentTeamQueryParams.value,
        [editingItem.value.name]: editingValue.value
      }

      updatedInstallation = await McpInstallationService.updateTeamQueryParams(
        props.teamId,
        props.installation.id,
        updatedQueryParams
      )
    } else {
      // Update team environment variables
      const updatedEnv = {
        ...currentTeamEnv.value,
        [editingItem.value.name]: editingValue.value
      }

      updatedInstallation = await McpInstallationService.updateTeamEnv(
        props.teamId,
        props.installation.id,
        updatedEnv
      )
    }

    // Emit update event to parent component
    emit('installation-updated', updatedInstallation)

    // Show success toast
    const itemName = editingType.value === 'arg' ?
      (editingItem.value.name || t('mcpInstallations.teamConfiguration.table.values.argumentNumber', { number: editingItem.value.index + 1 })) :
      editingItem.value.name
    toast.success(t('mcpInstallations.teamConfiguration.editModal.success.updated', { item: itemName }), {
      description: t('mcpInstallations.teamConfiguration.editModal.success.description')
    })

    closeEditModal()
  } catch (error) {
    console.error('Error updating team configuration:', error)
    formErrors.value.general = error instanceof Error ? error.message : t('mcpInstallations.teamConfiguration.editModal.errors.updateFailed')
  } finally {
    isSubmitting.value = false
  }
}

const modalTitle = computed(() => {
  if (!editingItem.value) return ''

  if (editingType.value === 'arg') {
    const argName = editingItem.value.name || t('mcpInstallations.teamConfiguration.table.values.argumentNumber', { number: editingItem.value.index + 1 })
    return t('mcpInstallations.teamConfiguration.editModal.titleArg', { name: argName })
  } else if (editingType.value === 'header') {
    return `Edit Team Header: ${editingItem.value.name}`
  } else if (editingType.value === 'query_param') {
    return `Edit Team Query Parameter: ${editingItem.value.name}`
  } else {
    return t('mcpInstallations.teamConfiguration.editModal.titleEnv', { name: editingItem.value.name })
  }
})
</script>

<template>
  <div>
    <div>
      <!-- Loading State -->
      <div v-if="isLoadingServer" class="px-4 py-12 sm:px-0 text-center">
        <div class="text-muted-foreground">{{ t('mcpInstallations.teamConfiguration.loading') }}</div>
      </div>

      <!-- Team Configuration Content -->
      <div v-else-if="hasTeamConfiguration" class="space-y-8">
        <!-- Team Arguments Section -->
        <div v-if="teamArgsSchema.length > 0">
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-900">{{ t('mcpInstallations.teamConfiguration.sections.teamArgs.title') }}</h4>
            <p class="text-xs text-gray-500">{{ t('mcpInstallations.teamConfiguration.sections.teamArgs.description') }}</p>
          </div>

          <ul role="list" class="space-y-3">
            <li v-for="arg in teamArgsWithData" :key="arg.index" class="flex items-center justify-between gap-x-6 py-5 bg-white dark:bg-card border rounded-lg px-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-start gap-x-3">
                  <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                    {{ arg.name || t('mcpInstallations.teamConfiguration.table.values.argumentNumber', { number: arg.index + 1 }) }}
                  </p>
                </div>
                <div class="mt-1 text-xs/5 text-gray-700">
                  <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.required') }}</span>
                  <span class="ml-1">{{ arg.required ? t('common.labels.yes') : t('common.labels.no') }}</span>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="space-y-1 text-xs/5 text-gray-700">
                  <div v-if="arg.type">
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.type') }}</span>
                    <span class="ml-1">{{ arg.type }}</span>
                  </div>
                  <div v-if="arg.description">
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.description') }}</span>
                    <span class="ml-1">{{ arg.description }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.value') }}</span>
                    <span v-if="arg.type === 'password' || arg.type === 'secret'" class="ml-1 font-mono">
                      {{ arg.currentValue ? '••••••••' : t('mcpInstallations.teamConfiguration.table.values.notSet') }}
                    </span>
                    <span v-else class="ml-1 font-mono">
                      {{ arg.currentValue || t('mcpInstallations.teamConfiguration.table.values.notSet') }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex flex-none items-center gap-x-4">
                <Button
                  v-if="canEdit"
                  size="sm"
                  variant="outline"
                  @click="openEditModal(arg, 'arg')"
                >
                  {{ t('mcpInstallations.teamConfiguration.table.actions.editValue') }}
                </Button>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  disabled
                  class="cursor-not-allowed opacity-50"
                >
                  {{ t('mcpInstallations.teamConfiguration.table.actions.editValue') }}
                </Button>
              </div>
            </li>
          </ul>
        </div>

        <!-- Team Environment Variables Section -->
        <div v-if="teamEnvSchema.length > 0">
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-900">{{ t('mcpInstallations.teamConfiguration.sections.teamEnv.title') }}</h4>
            <p class="text-xs text-gray-500">{{ t('mcpInstallations.teamConfiguration.sections.teamEnv.description') }}</p>
          </div>

          <ul role="list" class="space-y-3">
            <li v-for="envVar in teamEnvWithData" :key="envVar.name" class="flex items-center justify-between gap-x-6 py-5 bg-white dark:bg-card border rounded-lg px-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-start gap-x-3">
                  <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                    {{ envVar.name }}
                  </p>
                </div>
                <div class="mt-1 text-xs/5 text-gray-700">
                  <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.required') }}</span>
                  <span class="ml-1">{{ envVar.required ? t('common.labels.yes') : t('common.labels.no') }}</span>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="space-y-1 text-xs/5 text-gray-700">
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.type') }}</span>
                    <span class="ml-1">{{ envVar.type || t('mcpInstallations.teamConfiguration.table.labels.defaultType') }}</span>
                  </div>
                  <div v-if="envVar.visible_to_users === false">
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.hiddenFromUsers') }}</span>
                    <span class="ml-1">{{ t('common.labels.yes') }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.value') }}</span>
                    <span v-if="envVar.type === 'password' || envVar.type === 'secret'" class="ml-1 font-mono">
                      {{ envVar.currentValue ? '••••••••' : t('mcpInstallations.teamConfiguration.table.values.notSet') }}
                    </span>
                    <span v-else class="ml-1 font-mono">
                      {{ envVar.currentValue || t('mcpInstallations.teamConfiguration.table.values.notSet') }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex flex-none items-center gap-x-4">
                <Button
                  v-if="canEdit"
                  size="sm"
                  variant="outline"
                  @click="openEditModal(envVar, 'env')"
                >
                  {{ t('mcpInstallations.teamConfiguration.table.actions.editValue') }}
                </Button>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  disabled
                  class="cursor-not-allowed opacity-50"
                >
                  {{ t('mcpInstallations.teamConfiguration.table.actions.editValue') }}
                </Button>
              </div>
            </li>
          </ul>
        </div>

        <!-- Team Headers Section -->
        <div v-if="teamHeadersSchema.length > 0">
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-900">Team Headers</h4>
            <p class="text-xs text-gray-500">Configure HTTP headers that will be shared across all team members for this MCP server installation.</p>
          </div>

          <ul role="list" class="space-y-3">
            <li v-for="header in teamHeadersWithData" :key="header.name" class="flex items-center justify-between gap-x-6 py-5 bg-white dark:bg-card border rounded-lg px-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-start gap-x-3">
                  <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                    {{ header.name }}
                  </p>
                </div>
                <div class="mt-1 text-xs/5 text-gray-700">
                  <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.required') }}</span>
                  <span class="ml-1">{{ header.required ? t('common.labels.yes') : t('common.labels.no') }}</span>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="space-y-1 text-xs/5 text-gray-700">
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.type') }}</span>
                    <span class="ml-1">{{ header.type || t('mcpInstallations.teamConfiguration.table.labels.defaultType') }}</span>
                  </div>
                  <div v-if="header.visible_to_users === false">
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.hiddenFromUsers') }}</span>
                    <span class="ml-1">{{ t('common.labels.yes') }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.value') }}</span>
                    <span v-if="header.type === 'password' || header.type === 'secret'" class="ml-1 font-mono">
                      {{ header.currentValue ? '••••••••' : t('mcpInstallations.teamConfiguration.table.values.notSet') }}
                    </span>
                    <span v-else class="ml-1 font-mono">
                      {{ header.currentValue || t('mcpInstallations.teamConfiguration.table.values.notSet') }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex flex-none items-center gap-x-4">
                <Button
                  v-if="canEdit && (userRole === 'team_admin' || userRole === null)"
                  size="sm"
                  variant="outline"
                  @click="openEditModal(header, 'header')"
                >
                  {{ t('mcpInstallations.teamConfiguration.table.actions.editValue') }}
                </Button>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  disabled
                  class="cursor-not-allowed opacity-50"
                >
                  {{ t('mcpInstallations.teamConfiguration.table.actions.editValue') }}
                </Button>
              </div>
            </li>
          </ul>
        </div>

        <!-- Team Query Parameters Section -->
        <div v-if="teamQueryParamsSchema.length > 0">
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-900">Team URL Query Parameters</h4>
            <p class="text-xs text-gray-500">Configure URL query parameters that will be shared across all team members for this MCP server installation.</p>
          </div>

          <ul role="list" class="space-y-3">
            <li v-for="param in teamQueryParamsWithData" :key="param.name" class="flex items-center justify-between gap-x-6 py-5 bg-white dark:bg-card border rounded-lg px-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-start gap-x-3">
                  <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                    {{ param.name }}
                  </p>
                </div>
                <div class="mt-1 text-xs/5 text-gray-700">
                  <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.required') }}</span>
                  <span class="ml-1">{{ param.required ? t('common.labels.yes') : t('common.labels.no') }}</span>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="space-y-1 text-xs/5 text-gray-700">
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.type') }}</span>
                    <span class="ml-1">{{ param.type || t('mcpInstallations.teamConfiguration.table.labels.defaultType') }}</span>
                  </div>
                  <div v-if="param.visible_to_users === false">
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.hiddenFromUsers') }}</span>
                    <span class="ml-1">{{ t('common.labels.yes') }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-800">{{ t('mcpInstallations.teamConfiguration.table.labels.value') }}</span>
                    <span v-if="param.type === 'password' || param.type === 'secret'" class="ml-1 font-mono">
                      {{ param.currentValue ? '••••••••' : t('mcpInstallations.teamConfiguration.table.values.notSet') }}
                    </span>
                    <span v-else class="ml-1 font-mono">
                      {{ param.currentValue || t('mcpInstallations.teamConfiguration.table.values.notSet') }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex flex-none items-center gap-x-4">
                <Button
                  v-if="canEdit && (userRole === 'team_admin' || userRole === null)"
                  size="sm"
                  variant="outline"
                  @click="openEditModal(param, 'query_param')"
                >
                  {{ t('mcpInstallations.teamConfiguration.table.actions.editValue') }}
                </Button>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  disabled
                  class="cursor-not-allowed opacity-50"
                >
                  {{ t('mcpInstallations.teamConfiguration.table.actions.editValue') }}
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
        <h3 class="text-sm font-medium text-gray-900 mb-2">{{ t('mcpInstallations.teamConfiguration.emptyState.title') }}</h3>
        <p class="text-sm text-gray-500 max-w-sm mx-auto">
          {{ t('mcpInstallations.teamConfiguration.emptyState.description') }}
        </p>
      </div>
    </div>

    <!-- Edit Modal -->
    <AlertDialog :open="isEditModalOpen" @update:open="(value) => isEditModalOpen = value">
      <AlertDialogContent class="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ modalTitle }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('mcpInstallations.teamConfiguration.editModal.description') }}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Item Info -->
          <div v-if="editingItem" class="bg-gray-50 rounded-lg p-4 space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">
                {{ editingType === 'arg' ? t('mcpInstallations.teamConfiguration.editModal.form.labels.argument') : t('mcpInstallations.teamConfiguration.editModal.form.labels.variable') }}
              </span>
              <code class="bg-gray-200 text-gray-800 px-2 py-1 rounded font-mono text-xs font-semibold">
                {{ editingType === 'arg' ? (editingItem.name || t('mcpInstallations.teamConfiguration.table.values.argumentNumber', { number: editingItem.index + 1 })) : editingItem.name }}
              </code>
              <Badge v-if="editingItem.required" variant="default" class="text-xs">
                {{ t('mcpInstallations.teamConfiguration.table.values.required') }}
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
            <Label for="config-value">{{ t('mcpInstallations.teamConfiguration.editModal.form.labels.teamValue') }}</Label>

            <!-- Textarea for long values -->
            <div v-if="editingItem && isTextarea(editingItem)" class="relative">
              <Textarea
                id="config-value"
                v-model="editingValue"
                :placeholder="editingItem.placeholder || t('mcpInstallations.teamConfiguration.editModal.form.placeholders.enterValue')"
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
                :placeholder="editingItem?.placeholder || t('mcpInstallations.teamConfiguration.editModal.form.placeholders.enterValue')"
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
                  {{ showPassword ? t('mcpInstallations.teamConfiguration.editModal.form.actions.hideValue') : t('mcpInstallations.teamConfiguration.editModal.form.actions.showValue') }}
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
              {{ t('mcpInstallations.teamConfiguration.editModal.form.buttons.cancel') }}
            </Button>
            <Button type="submit" :disabled="isSubmitting">
              {{ isSubmitting ? t('mcpInstallations.teamConfiguration.editModal.form.buttons.saving') : t('mcpInstallations.teamConfiguration.editModal.form.buttons.save') }}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
