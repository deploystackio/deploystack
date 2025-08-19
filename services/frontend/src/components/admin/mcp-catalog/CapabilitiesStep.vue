<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Edit, Trash2, Settings, MoreHorizontal } from 'lucide-vue-next'
import type { EnvironmentVariable, CapabilitiesFormData } from '@/views/admin/mcp-server-catalog/types'

// Extended interface for form editing
interface ExtendedEnvironmentVariable extends EnvironmentVariable {
  type?: string
  validation?: string
  placeholder?: string
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData?: any
  mode?: 'create' | 'edit'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create'
})
const { t } = useI18n()
const eventBus = useEventBus()

// Storage key for capabilities data
const STORAGE_KEY = 'edit_capabilities_data'

// Local reactive data - storage-first approach
const localData = ref<CapabilitiesFormData>({
  tools: [],
  resources: [],
  prompts: [],
  environment_variables: []
})

// Flag to prevent recursive updates
const isUpdatingFromStorage = ref(false)

// Modal state
const isModalOpen = ref(false)
const modalMode = ref<'add' | 'edit'>('add')
const editingIndex = ref(-1)

// Form state
const formDataLocal = ref<ExtendedEnvironmentVariable>({
  name: '',
  description: '',
  required: false,
  type: 'text',
  validation: '',
  placeholder: ''
})

const formErrors = ref<Record<string, string>>({})

// Smart merge function for environment variables
const mergeEnvironmentVariables = (databaseEnvVars: EnvironmentVariable[], technicalEnvVars: EnvironmentVariable[]): EnvironmentVariable[] => {
  const merged: EnvironmentVariable[] = []

  // Create a map of technical env vars by name for quick lookup
  const technicalMap = new Map<string, EnvironmentVariable>()
  technicalEnvVars.forEach(envVar => {
    technicalMap.set(envVar.name, envVar)
  })

  // First, add all database env vars (preserving their properties)
  databaseEnvVars.forEach(dbEnvVar => {
    if (technicalMap.has(dbEnvVar.name)) {
      // This env var exists in both - keep database properties, ensure name is correct
      merged.push({ ...dbEnvVar, name: dbEnvVar.name })
      // Remove from technical map so we don't add it again
      technicalMap.delete(dbEnvVar.name)
    }
    // If database env var doesn't exist in technical step, we still keep it
    // (user might have manually added it)
    else {
      merged.push(dbEnvVar)
    }
  })

  // Then, add any remaining technical env vars (new ones not in database)
  technicalMap.forEach(techEnvVar => {
    merged.push(techEnvVar)
  })

  return merged
}

// Load data from storage with smart merging
const loadFromStorage = () => {
  isUpdatingFromStorage.value = true

  const storedData = eventBus.getState<CapabilitiesFormData>(STORAGE_KEY)
  if (storedData) {
    localData.value = { ...localData.value, ...storedData }
  }

  // Smart merge: prioritize database values over technical step defaults
  const envVarsFromTechnical = eventBus.getState('capabilities_env_vars')
  if (envVarsFromTechnical && Array.isArray(envVarsFromTechnical)) {
    // If we have database values (from props in edit mode), merge intelligently
    const databaseEnvVars = localData.value.environment_variables || []

    if (databaseEnvVars.length > 0) {
      // Merge: keep database properties, add new vars from technical step
      const mergedEnvVars = mergeEnvironmentVariables(databaseEnvVars, envVarsFromTechnical)
      localData.value.environment_variables = mergedEnvVars
    } else {
      // No database values, use technical step values
      localData.value.environment_variables = envVarsFromTechnical
    }
  }

  isUpdatingFromStorage.value = false
}

// Initialize from props data (for edit mode)
const initializeFromProps = () => {
  if (props.formData?.capabilities && props.mode === 'edit') {
    isUpdatingFromStorage.value = true

    // Initialize with database data
    localData.value = {
      ...localData.value,
      ...props.formData.capabilities
    }

    // Store in storage for other components
    eventBus.setState(STORAGE_KEY, localData.value)

    // Store environment variables separately for wizard submission
    if (localData.value.environment_variables) {
      eventBus.setState('capabilities_env_vars', localData.value.environment_variables)
    }

    isUpdatingFromStorage.value = false
  }
}

// Save data to storage
const saveToStorage = () => {
  if (!isUpdatingFromStorage.value) {
    eventBus.setState(STORAGE_KEY, localData.value)
  }
}

// Listen for storage changes from other components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleStorageChange = (data: { key: string; newValue: any }) => {
  if (isUpdatingFromStorage.value) return

  if (data.key === STORAGE_KEY && data.newValue) {
    isUpdatingFromStorage.value = true
    localData.value = { ...localData.value, ...data.newValue }
    isUpdatingFromStorage.value = false
  } else if (data.key === 'capabilities_env_vars' && data.newValue) {
    // Update environment variables from technical step
    isUpdatingFromStorage.value = true
    localData.value.environment_variables = data.newValue
    saveToStorage()
    isUpdatingFromStorage.value = false
  }
}

// Computed properties
const environmentVariables = computed(() => {
  return localData.value.environment_variables || []
})

const isFormValid = computed(() => {
  return formDataLocal.value.name.trim() !== '' && Object.keys(formErrors.value).length === 0
})

// Modal management
const openAddModal = () => {
  modalMode.value = 'add'
  editingIndex.value = -1
  resetForm()
  isModalOpen.value = true
}

const openEditModal = (index: number) => {
  modalMode.value = 'edit'
  editingIndex.value = index
  const variable = environmentVariables.value[index]
  if (variable) {
    formDataLocal.value = {
      name: variable.name || '',
      description: variable.description || '',
      required: variable.required || false,
      type: (variable as ExtendedEnvironmentVariable).type || 'text',
      validation: (variable as ExtendedEnvironmentVariable).validation || '',
      placeholder: (variable as ExtendedEnvironmentVariable).placeholder || ''
    }
  }
  formErrors.value = {}
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
  resetForm()
}

const resetForm = () => {
  formDataLocal.value = {
    name: '',
    description: '',
    required: false,
    type: 'text',
    validation: '',
    placeholder: ''
  }
  formErrors.value = {}
}

// Form validation
const validateForm = () => {
  const errors: Record<string, string> = {}

  if (!formDataLocal.value.name.trim()) {
    errors.name = t('mcpCatalog.form.capabilities.environmentVariables.validation.nameRequired')
  } else if (!/^[A-Z_][A-Z0-9_]*$/.test(formDataLocal.value.name)) {
    errors.name = t('mcpCatalog.form.capabilities.environmentVariables.validation.nameFormat')
  } else {
    // Check for duplicates (excluding current item when editing)
    // Only check for duplicates if the name has actually changed
    const currentItem = modalMode.value === 'edit' ? environmentVariables.value[editingIndex.value] : null
    const nameChanged = !currentItem || currentItem.name !== formDataLocal.value.name

    if (nameChanged) {
      const isDuplicate = environmentVariables.value.some((variable: EnvironmentVariable, index: number) =>
        variable.name === formDataLocal.value.name && index !== editingIndex.value
      )
      if (isDuplicate) {
        errors.name = t('mcpCatalog.form.capabilities.environmentVariables.validation.nameDuplicate')
      }
    }
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

// CRUD operations
const handleSubmit = () => {
  // Only transform name to uppercase if it's not already uppercase (avoid unnecessary changes)
  const originalName = formDataLocal.value.name
  formDataLocal.value.name = formDataLocal.value.name.toUpperCase()

  if (!validateForm()) {
    // Restore original name if validation fails to prevent side effects
    formDataLocal.value.name = originalName
    return
  }

  const updatedVariables = [...environmentVariables.value]

  if (modalMode.value === 'add') {
    updatedVariables.push({ ...formDataLocal.value })
  } else {
    updatedVariables[editingIndex.value] = { ...formDataLocal.value }
  }

  updateFormData(updatedVariables)
  closeModal()
}

const handleDelete = (index: number) => {
  const updatedVariables = environmentVariables.value.filter((_: EnvironmentVariable, i: number) => i !== index)
  updateFormData(updatedVariables)
}

const updateFormData = (newEnvironmentVariables: EnvironmentVariable[]) => {
  // Prevent recursive updates
  isUpdatingFromStorage.value = true

  // Update local data directly
  localData.value.environment_variables = newEnvironmentVariables

  // Store in both storage locations
  eventBus.setState(STORAGE_KEY, localData.value)
  eventBus.setState('capabilities_env_vars', newEnvironmentVariables)

  // Immediately update the Claude Desktop JSON config in storage
  updateClaudeDesktopConfigInStorage(newEnvironmentVariables)

  isUpdatingFromStorage.value = false
}

const modalTitle = computed(() => {
  return modalMode.value === 'add'
    ? t('mcpCatalog.form.capabilities.environmentVariables.addVariable')
    : t('mcpCatalog.form.capabilities.environmentVariables.editVariable')
})

// Function to update Claude Desktop JSON config directly in storage
const updateClaudeDesktopConfigInStorage = (envVars: EnvironmentVariable[]) => {
  const TECHNICAL_STORAGE_KEY = 'edit_claude_config'

  try {
    // Get current JSON config from TechnicalStep storage
    let currentJsonString = eventBus.getState<string>(TECHNICAL_STORAGE_KEY)

    // If no config exists, try to create a basic one from form data
    if (!currentJsonString || !currentJsonString.trim()) {

      // Try to get server info from technical form data
      const technicalData = props.formData?.technical
      if (technicalData?.installation_methods?.[0]) {
        const method = technicalData.installation_methods[0]
        const serverName = extractServerNameFromTechnical(method) || 'mcp-server'

        const basicConfig = {
          mcpServers: {
            [serverName]: {
              command: method.command || 'npx',
              args: method.args || [],
              env: {}
            }
          }
        }

        currentJsonString = JSON.stringify(basicConfig, null, 2)
      } else {
        // Cannot create config - no technical data available
        return
      }
    }

    const parsed = JSON.parse(currentJsonString)

    // Validate structure
    if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
      return
    }

    const serverKeys = Object.keys(parsed.mcpServers)
    if (serverKeys.length !== 1) {
      return
    }

    const serverKey = serverKeys[0]
    if (!serverKey) return
    const serverConfig = parsed.mcpServers[serverKey]

    // Build new env vars object
    const newEnvVars: Record<string, string> = {}
    envVars.forEach(envVar => {
      const placeholder = `<insert-your-${envVar.name.toLowerCase().replace(/_/g, '-')}-here>`
      newEnvVars[envVar.name] = placeholder
    })

    // Update the env section
    serverConfig.env = newEnvVars

    // Save updated JSON back to storage
    const updatedJsonString = JSON.stringify(parsed, null, 2)
    eventBus.setState(TECHNICAL_STORAGE_KEY, updatedJsonString)

    // Force immediate sync by emitting a storage change event
    eventBus.emit('storage-changed', {
      key: TECHNICAL_STORAGE_KEY,
      oldValue: currentJsonString,
      newValue: updatedJsonString
    })

  } catch {
    // Failed to update Claude Desktop config
  }
}

// Helper function to extract server name from technical data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractServerNameFromTechnical = (method: any): string => {
  // Try to extract from package name in args
  if (method.args && method.args.length > 0) {
    for (const arg of method.args) {
      // Handle npm packages like "@brightdata/mcp" or "playwright-mcp"
      if (arg.includes('/')) {
        const parts = arg.split('/')
        return parts[parts.length - 1].replace('-mcp', '').replace('mcp-', '')
      }
      // Handle direct package names
      if (arg.includes('mcp') || arg.includes('-')) {
        return arg.replace('-mcp', '').replace('mcp-', '')
      }
    }
  }

  // Try to extract from basic data in storage
  const basicData = eventBus.getState<{ name?: string }>('edit_basic_data')
  if (basicData?.name) {
    return basicData.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace('-mcp', '')
      .replace('mcp-', '')
  }

  return 'mcp-server'
}

// Fresh data loading on step entry
const refreshDataOnStepEntry = () => {
  // Always reload fresh data when entering this step
  if (props.mode === 'edit') {
    initializeFromProps()
  }
  loadFromStorage()
}

// Listen for step changes
const handleStepChange = (data: { to: number; stepKey: string }) => {
  if (data.stepKey === 'capabilities') {
    refreshDataOnStepEntry()
  }
}

onMounted(() => {
  // First initialize from props (database data in edit mode)
  initializeFromProps()

  // Then load any additional data from storage
  loadFromStorage()

  // Listen for storage changes
  eventBus.on('storage-changed', handleStorageChange)

  // Listen for step changes to refresh data
  eventBus.on('mcp-form-step-changed', handleStepChange)
})

onUnmounted(() => {
  // Clean up event listeners
  eventBus.off('storage-changed', handleStorageChange)
  eventBus.off('mcp-form-step-changed', handleStepChange)
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium">{{ t('mcpCatalog.form.capabilities.environmentVariables.label') }}</h3>
      <p class="text-sm text-muted-foreground">
        {{ t('mcpCatalog.form.capabilities.environmentVariables.description') }}
      </p>
    </div>


    <!-- Header with Add Button -->
    <div class="flex items-center justify-between">
      <div></div>
      <Button
        type="button"
        @click="openAddModal"
        class="flex items-center gap-2"
      >
        <Plus class="h-4 w-4" />
        {{ t('mcpCatalog.form.capabilities.environmentVariables.addVariable') }}
      </Button>
    </div>

    <!-- Environment Variables Display with Edit Actions -->
    <div v-if="environmentVariables.length > 0" class="overflow-hidden">
      <table class="w-full text-left">
        <thead class="sr-only">
          <tr>
            <th>{{ t('mcpCatalog.form.capabilities.environmentVariables.name.label') }}</th>
            <th class="hidden sm:table-cell">{{ t('mcpCatalog.table.columns.properties', 'Properties') }}</th>
            <th class="hidden sm:table-cell">{{ t('mcpCatalog.table.columns.details', 'Details') }}</th>
            <th>{{ t('mcpCatalog.table.columns.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(variable, index) in environmentVariables" :key="index">
            <td class="relative py-5 pr-6">
              <div class="flex gap-x-6">
                <div class="flex-auto">
                  <div class="flex items-start gap-x-3">
                    <div class="text-sm/6 font-semibold text-gray-900">
                      {{ variable.name }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="absolute right-full bottom-0 h-px w-screen bg-gray-100" />
              <div class="absolute bottom-0 left-0 h-px w-screen bg-gray-100" />
            </td>
            <td class="hidden py-5 pr-6 sm:table-cell">
              <div class="space-y-1">
                <div v-if="variable.required" class="text-xs/5 text-gray-500">
                  <span class="font-medium">{{ t('mcpCatalog.form.capabilities.environmentVariables.required.label') }}:</span> {{ t('common.labels.yes') }}
                </div>
                <div v-if="(variable as ExtendedEnvironmentVariable).type" class="text-xs/5 text-gray-500">
                  <span class="font-medium">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.label') }}:</span> {{ (variable as ExtendedEnvironmentVariable).type }}
                </div>
              </div>
            </td>
            <td class="hidden py-5 pr-6 sm:table-cell">
              <div v-if="variable.description" class="text-sm/6 text-gray-900">
                {{ variable.description }}
              </div>
              <div v-if="(variable as ExtendedEnvironmentVariable).placeholder" class="mt-1 text-xs/5 text-gray-500">
                {{ t('mcpCatalog.form.capabilities.environmentVariables.placeholder.label') }}: {{ (variable as ExtendedEnvironmentVariable).placeholder }}
              </div>
            </td>
            <td class="py-5 text-right">
              <div class="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" class="h-8 w-8 p-0">
                      <span class="sr-only">{{ t('mcpCatalog.table.openMenu') }} {{ variable.name }}</span>
                      <MoreHorizontal class="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click="openEditModal(index)">
                      <Edit class="mr-2 h-4 w-4" />
                      {{ t('mcpCatalog.table.actions.edit') }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      @click="handleDelete(index)"
                      class="text-red-600 focus:text-red-600"
                    >
                      <Trash2 class="mr-2 h-4 w-4" />
                      {{ t('mcpCatalog.table.actions.delete') }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
        <Settings class="h-6 w-6 text-gray-400" />
      </div>
      <h3 class="text-sm font-medium text-gray-900 mb-2">{{ t('mcpCatalog.form.capabilities.environmentVariables.noVariables') }}</h3>
      <p class="text-sm text-gray-500 max-w-sm mx-auto">
        {{ t('mcpCatalog.form.capabilities.environmentVariables.noVariablesDescription') }}
      </p>
    </div>

    <!-- Add/Edit Environment Variable Modal -->
    <AlertDialog :open="isModalOpen" @update:open="(value) => isModalOpen = value">
      <AlertDialogContent class="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ modalTitle }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ modalMode === 'add'
              ? t('mcpCatalog.form.capabilities.environmentVariables.addDescription')
              : t('mcpCatalog.form.capabilities.environmentVariables.editDescription')
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Variable Name -->
          <div class="space-y-2">
            <Label for="var-name">{{ t('mcpCatalog.form.capabilities.environmentVariables.name.label') }}</Label>
            <Input
              id="var-name"
              v-model="formDataLocal.name"
              :placeholder="t('mcpCatalog.form.capabilities.environmentVariables.name.placeholder')"
              :class="{ 'border-destructive': formErrors.name }"
              class="font-mono"
              required
            />
            <div v-if="formErrors.name" class="text-sm text-destructive">
              {{ formErrors.name }}
            </div>
          </div>

          <!-- Description -->
          <div class="space-y-2">
            <Label for="var-description">{{ t('mcpCatalog.form.capabilities.environmentVariables.variableDescription.label') }}</Label>
            <Textarea
              id="var-description"
              v-model="formDataLocal.description"
              :placeholder="t('mcpCatalog.form.capabilities.environmentVariables.variableDescription.placeholder')"
              rows="2"
            />
          </div>

          <!-- Type -->
          <div class="space-y-2">
            <Label for="var-type">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.label') }}</Label>
            <Select v-model="formDataLocal.type">
              <SelectTrigger>
                <SelectValue :placeholder="t('mcpCatalog.form.capabilities.environmentVariables.type.placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.options.text') }}</SelectItem>
                <SelectItem value="password">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.options.password') }}</SelectItem>
                <SelectItem value="number">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.options.number') }}</SelectItem>
                <SelectItem value="url">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.options.url') }}</SelectItem>
                <SelectItem value="email">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.options.email') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Placeholder -->
          <div class="space-y-2">
            <Label for="var-placeholder">{{ t('mcpCatalog.form.capabilities.environmentVariables.placeholder.label') }}</Label>
            <Input
              id="var-placeholder"
              v-model="formDataLocal.placeholder"
              :placeholder="t('mcpCatalog.form.capabilities.environmentVariables.placeholder.placeholder')"
            />
          </div>

          <!-- Required Toggle -->
          <div class="flex items-center space-x-2">
            <Switch
              id="var-required"
              :model-value="formDataLocal.required"
              @update:model-value="(value: boolean) => formDataLocal.required = value"
            />
            <Label for="var-required">{{ t('mcpCatalog.form.capabilities.environmentVariables.required.description') }}</Label>
          </div>

          <!-- Validation (Advanced) -->
          <div class="space-y-2">
            <Label for="var-validation">{{ t('mcpCatalog.form.capabilities.environmentVariables.validation.label') }}</Label>
            <Input
              id="var-validation"
              v-model="formDataLocal.validation"
              :placeholder="t('mcpCatalog.form.capabilities.environmentVariables.validation.placeholder')"
              class="font-mono text-sm"
            />
            <p class="text-xs text-muted-foreground">
              {{ t('mcpCatalog.form.capabilities.environmentVariables.validation.description') }}
            </p>
          </div>

          <AlertDialogFooter>
            <Button type="button" variant="outline" @click="closeModal">
              {{ t('mcpCatalog.form.navigation.cancel') }}
            </Button>
            <Button type="submit" :disabled="!isFormValid">
              {{ modalMode === 'add' ? t('mcpCatalog.form.capabilities.environmentVariables.submitAdd') : t('mcpCatalog.form.capabilities.environmentVariables.submitEdit') }}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
