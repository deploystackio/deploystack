<!--
 * EDIT MODE CONFIGURATION SCHEMA STEP
 *
 * This component follows the EDIT wizard storage-first architecture:
 * - Uses event bus and localStorage exclusively
 * - No v-model or props for data management
 * - Storage-first patterns throughout
 * - Reads/writes data directly to/from storage
 * - NO PROPS ALLOWED - pure storage + event bus only!
 * - Component is completely self-contained and reactive via storage
 -->

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
import { Badge } from '@/components/ui/badge'

import { Plus, Edit, Trash2, MoreHorizontal, Terminal, Users, User, Lock } from 'lucide-vue-next'
import ConfigurationSchemaEnvironmentSection from './ConfigurationSchemaEnvironmentSection.vue'

const { t } = useI18n()
const eventBus = useEventBus()

// Storage keys for edit mode
const STORAGE_KEY = 'edit_configuration_schema'

// Define types for our categorized items
type ArgCategory = 'template' | 'team' | 'user'
type EnvCategory = 'team' | 'user'
type ItemType = 'arg' | 'env'

interface ConfigItem {
  id: string
  type: ItemType
  category: ArgCategory | EnvCategory
  name: string
  value?: string // For template args
  description: string
  dataType: string // 'string' | 'number' | 'boolean'
  required: boolean
  locked: boolean
  default_team_locked?: boolean
  visible_to_users?: boolean // For env vars only
}

interface ConfigurationSchema {
  template_args?: TemplateArg[]
  template_env?: TemplateEnvVar[]
  team_args_schema?: TeamArgsSchema[]
  team_env_schema?: TeamEnvSchema[]
  user_args_schema?: UserArgsSchema[]
  user_env_schema?: UserEnvSchema[]
}

interface TemplateArg {
  value: string
  locked: boolean
  description?: string
}

interface TemplateEnvVar {
  name: string
  value: string
  locked: boolean
  description?: string
}

interface TeamArgsSchema {
  name: string
  type: string
  description?: string
  required: boolean
  locked: boolean
  default_team_locked?: boolean
}

interface TeamEnvSchema {
  name: string
  type: string
  description?: string
  required: boolean
  locked: boolean
  default_team_locked?: boolean
  visible_to_users?: boolean
}

interface UserArgsSchema {
  name: string
  type: string
  description?: string
  required: boolean
  locked: boolean
}

interface UserEnvSchema {
  name: string
  type: string
  description?: string
  required: boolean
  locked: boolean
}

// Local reactive data - storage-first approach
const localData = ref<ConfigItem[]>([])

// Flag to prevent recursive updates
const isUpdatingFromStorage = ref(false)

// Modal state
const isModalOpen = ref(false)
const modalMode = ref<'add' | 'edit'>('add')
const editingIndex = ref(-1)

// Form state
const formDataLocal = ref<ConfigItem>({
  id: '',
  type: 'arg',
  category: 'template',
  name: '',
  value: '',
  description: '',
  dataType: 'string',
  required: false,
  locked: false,
  default_team_locked: false,
  visible_to_users: false
})

const formErrors = ref<Record<string, string>>({})

// Configuration levels
const argCategoryOptions = [
  { value: 'template', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.template')), icon: Terminal, color: 'blue' },
  { value: 'team', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.team')), icon: Users, color: 'green' },
  { value: 'user', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.user')), icon: User, color: 'purple' },
]

// Removed envCategoryOptions - now handled by shared component

const typeOptions = [
  { value: 'string', label: computed(() => t('mcpCatalog.form.configurationSchema.dataTypes.string')) },
  { value: 'number', label: computed(() => t('mcpCatalog.form.configurationSchema.dataTypes.number')) },
  { value: 'boolean', label: computed(() => t('mcpCatalog.form.configurationSchema.dataTypes.boolean')) },
]

// Load data from existing schema in storage
const loadFromStorageSchema = () => {
  const storedSchema = eventBus.getState<ConfigurationSchema>(STORAGE_KEY)
  if (!storedSchema) return

  const items: ConfigItem[] = []

  // Convert template args
  ;(storedSchema.template_args || []).forEach((arg, index) => {
    items.push({
      id: `template_arg_${index}`,
      type: 'arg',
      category: 'template',
      name: arg.value, // Use the actual value as the name
      value: arg.value, // Keep value for reference
      description: arg.description || '',
      dataType: 'string',
      required: true,
      locked: arg.locked,
      default_team_locked: false,
    })
  })

  // Convert team args schema
  ;(storedSchema.team_args_schema || []).forEach((arg, index) => {
    items.push({
      id: `team_arg_${index}`,
      type: 'arg',
      category: 'team',
      name: arg.name,
      description: arg.description || '',
      dataType: arg.type || 'string',
      required: arg.required || false,
      locked: arg.locked || false,
      default_team_locked: arg.default_team_locked || false,
    })
  })

  // Convert user args schema
  ;(storedSchema.user_args_schema || []).forEach((arg, index) => {
    items.push({
      id: `user_arg_${index}`,
      type: 'arg',
      category: 'user',
      name: arg.name,
      description: arg.description || '',
      dataType: arg.type || 'string',
      required: arg.required || false,
      locked: arg.locked || false,
    })
  })

  // Convert team env schema
  ;(storedSchema.team_env_schema || []).forEach((env, index) => {
    items.push({
      id: `team_env_${index}`,
      type: 'env',
      category: 'team',
      name: env.name,
      description: env.description || '',
      dataType: env.type || 'string',
      required: env.required || false,
      locked: env.locked || false,
      default_team_locked: env.default_team_locked || false,
      visible_to_users: env.visible_to_users || false,
    })
  })

  // Convert user env schema
  ;(storedSchema.user_env_schema || []).forEach((env, index) => {
    items.push({
      id: `user_env_${index}`,
      type: 'env',
      category: 'user',
      name: env.name,
      description: env.description || '',
      dataType: env.type || 'string',
      required: env.required || false,
      locked: env.locked || false,
    })
  })


  localData.value = items
}

// Assemble the final configuration_schema object and save to storage
const assembleSchemaAndSave = () => {
  const schema: ConfigurationSchema = {
    template_args: [],
    template_env: [],
    team_args_schema: [],
    team_env_schema: [],
    user_args_schema: [],
    user_env_schema: [],
  }

  localData.value.forEach(item => {
    if (item.type === 'arg') {
      if (item.category === 'template') {
        schema.template_args!.push({
          value: item.value || '',
          locked: item.locked,
          description: item.description
        })
      } else if (item.category === 'team') {
        schema.team_args_schema!.push({
          name: item.name,
          type: item.dataType,
          description: item.description,
          required: item.required,
          locked: item.locked,
          default_team_locked: item.default_team_locked
        })
      } else if (item.category === 'user') {
        schema.user_args_schema!.push({
          name: item.name,
          type: item.dataType,
          description: item.description,
          required: item.required,
          locked: item.locked
        })
      }
    } else if (item.type === 'env') {
      if (item.category === 'team') {
        schema.team_env_schema!.push({
          name: item.name,
          type: item.dataType,
          description: item.description,
          required: item.required,
          locked: item.locked,
          default_team_locked: item.default_team_locked,
          visible_to_users: item.visible_to_users
        })
      } else if (item.category === 'user') {
        schema.user_env_schema!.push({
          name: item.name,
          type: item.dataType,
          description: item.description,
          required: item.required,
          locked: item.locked
        })
      }
    }
  })

  if (!isUpdatingFromStorage.value) {
    eventBus.setState(STORAGE_KEY, schema)
  }
}

// Computed properties
const argumentItems = computed(() => {
  return localData.value.filter(item => item.type === 'arg')
})

const environmentItems = computed(() => {
  return localData.value.filter(item => item.type === 'env')
})

const isFormValid = computed(() => {
  return formDataLocal.value.name.trim() !== '' && Object.keys(formErrors.value).length === 0
})

// Modal management
const openAddModal = (type: ItemType) => {
  modalMode.value = 'add'
  editingIndex.value = -1
  resetForm()
  formDataLocal.value.type = type
  formDataLocal.value.category = type === 'arg' ? 'template' : 'team'
  isModalOpen.value = true
}

const openEditModal = (index: number) => {
  modalMode.value = 'edit'
  editingIndex.value = index
  const item = localData.value[index]
  if (item) {
    formDataLocal.value = { ...item }
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
    id: '',
    type: 'arg',
    category: 'template',
    name: '',
    value: '',
    description: '',
    dataType: 'string',
    required: false,
    locked: false,
    default_team_locked: false,
    visible_to_users: false
  }
  formErrors.value = {}
}

// Form validation
const validateForm = () => {
  const errors: Record<string, string> = {}

  if (!formDataLocal.value.name.trim()) {
    errors.name = t('mcpCatalog.form.configurationSchema.modal.validation.nameRequired')
  } else {
    // Check for duplicates
    const isDuplicate = localData.value.some((item, index) =>
      item.name === formDataLocal.value.name &&
      item.type === formDataLocal.value.type &&
      index !== editingIndex.value
    )
    if (isDuplicate) {
      errors.name = t('mcpCatalog.form.configurationSchema.modal.validation.nameExists')
    }
  }

  if (formDataLocal.value.category === 'template' && formDataLocal.value.type === 'arg' && !formDataLocal.value.value?.trim()) {
    errors.value = t('mcpCatalog.form.configurationSchema.modal.validation.valueRequired')
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

// CRUD operations
const handleSubmit = () => {
  if (!validateForm()) return

  const updatedData = [...localData.value]
  const newItem = {
    ...formDataLocal.value,
    id: formDataLocal.value.id || `${formDataLocal.value.type}_${Date.now()}`
  }

  if (modalMode.value === 'add') {
    updatedData.push(newItem)
  } else {
    updatedData[editingIndex.value] = newItem
  }

  // FIXED: Direct synchronous storage update (bypasses broken updateData function)
  localData.value = updatedData
  assembleSchemaAndSave()

  closeModal()
}

const handleDelete = (index: number) => {
  const updatedData = localData.value.filter((_, i) => i !== index)
  updateData(updatedData)
}

const updateData = (newData: ConfigItem[]) => {
  isUpdatingFromStorage.value = true
  localData.value = newData
  assembleSchemaAndSave()
  isUpdatingFromStorage.value = false
}

// Get category info for display with safe fallback
const getCategoryInfo = (category: string) => {
  const allOptions = [...argCategoryOptions,
    { value: 'team', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.team')), icon: Users, color: 'green' },
    { value: 'user', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.user')), icon: User, color: 'purple' },
  ]
  const found = allOptions.find(opt => opt.value === category)
  if (found) {
    return {
      ...found,
      label: found.label.value // Access the computed value
    }
  }
  return {
    value: 'template',
    label: t('mcpCatalog.form.configurationSchema.categories.template'),
    icon: Terminal,
    color: 'blue'
  }
}

// Get modal title
const modalTitle = computed(() => {
  const modalKey = modalMode.value === 'add' ? 'add' : 'edit'
  const typeKey = formDataLocal.value.type === 'arg' ? 'argument' : 'environment'
  return t(`mcpCatalog.form.configurationSchema.modal.${modalKey}.${typeKey}`)
})

// Environment Variables event handlers
const handleEnvAdd = () => {
  openAddModal('env')
}

const handleEnvEdit = (index: number) => {
  const envItems = environmentItems.value
  const envItem = envItems[index]
  if (!envItem) return
  const globalIndex = localData.value.findIndex(item => item.id === envItem.id)
  openEditModal(globalIndex)
}

const handleEnvDelete = (index: number) => {
  const envItems = environmentItems.value
  const envItem = envItems[index]
  if (!envItem) return
  const globalIndex = localData.value.findIndex(item => item.id === envItem.id)
  handleDelete(globalIndex)
}

// Get available category options for current type
const availableCategoryOptions = computed(() => {
  return formDataLocal.value.type === 'arg' ? argCategoryOptions : [
    { value: 'team', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.team')), icon: Users, color: 'green' },
    { value: 'user', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.user')), icon: User, color: 'purple' },
  ]
})

// Fresh data loading on step entry
const refreshDataOnStepEntry = () => {
  loadFromStorageSchema()

  // Load persisted environment variables from TechnicalStep
  const extractedEnvVars = eventBus.getState<string[]>('technical_extracted_env_vars_edit')

  if (extractedEnvVars && extractedEnvVars.length > 0) {
    handleTechnicalEnvVarsUpdate({ envVars: extractedEnvVars })
  }
}

// Listen for step changes
const handleStepChange = (data: { to: number; stepKey: string }) => {
  if (data.stepKey === 'configurationSchema') {
    // Small delay to ensure other components have finished saving their data
    setTimeout(() => {
      refreshDataOnStepEntry()
    }, 100) // Small delay to ensure storage is updated
  }
}

// Handle Environment Variables sync from TechnicalStep
const handleTechnicalEnvVarsUpdate = (data: { envVars: string[] }) => {
  // Get current environment variables to avoid duplicates
  const currentEnvNames = environmentItems.value.map(item => item.name)

  // Add new environment variables that don't already exist
  const newItems: ConfigItem[] = []

  data.envVars.forEach(envVarName => {
    if (!currentEnvNames.includes(envVarName)) {
      newItems.push({
        id: `env_${envVarName}_${Date.now()}`,
        type: 'env',
        category: 'team', // Default to team configurable
        name: envVarName,
        description: 'Automatically detected from Claude Desktop configuration',
        dataType: 'string',
        required: false, // Default to not required
        locked: false,
        default_team_locked: false,
        visible_to_users: true,
      })
    }
  })

  // Add new items to existing data
  if (newItems.length > 0) {
    const updatedData = [...localData.value, ...newItems]
    updateData(updatedData)
  }
}

onMounted(() => {
  // Initialize with current storage data
  loadFromStorageSchema()

  // Listen for step changes
  eventBus.on('mcp-form-step-changed', handleStepChange)

  // Listen for environment variables updates from TechnicalStep
  eventBus.on('technical-env-vars-updated', handleTechnicalEnvVarsUpdate)

  // Load persisted env vars immediately on mount
  const extractedEnvVars = eventBus.getState<string[]>('technical_extracted_env_vars_edit')
  if (extractedEnvVars && extractedEnvVars.length > 0) {
    handleTechnicalEnvVarsUpdate({ envVars: extractedEnvVars })
  }
})

onUnmounted(() => {
  eventBus.off('mcp-form-step-changed', handleStepChange)
  eventBus.off('technical-env-vars-updated', handleTechnicalEnvVarsUpdate)
})
</script>

<template>
  <div class="space-y-6">

    <!-- Arguments Section -->
    <div class="space-y-4">
      <div>
        <h4 class="text-md font-medium">{{ $t('mcpCatalog.form.configurationSchema.arguments.title') }}</h4>
        <p class="text-sm text-muted-foreground">
          {{ $t('mcpCatalog.form.configurationSchema.arguments.description') }}
        </p>
      </div>

      <!-- Header with Add Button -->
      <div class="flex items-center justify-between">
        <div></div>
        <Button
          type="button"
          @click="openAddModal('arg')"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ $t('mcpCatalog.form.configurationSchema.arguments.addButton') }}
        </Button>
      </div>

      <!-- Arguments Display with Edit Actions -->
      <div v-if="argumentItems.length > 0" class="overflow-hidden">
        <table class="w-full text-left">
          <thead class="sr-only">
            <tr>
              <th>Name</th>
              <th class="hidden sm:table-cell">Properties</th>
              <th class="hidden sm:table-cell">Details</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item) in argumentItems" :key="item.id">
              <td class="relative py-5 pr-6">
                <div class="flex gap-x-6">
                  <div class="flex-auto">
                    <div class="flex items-start gap-x-3">
                      <div class="text-sm/6 font-semibold text-gray-900">
                        {{ item.name }}
                      </div>
                    </div>
                    <Badge :class="`bg-${getCategoryInfo(item.category).color}-100 text-${getCategoryInfo(item.category).color}-800 mt-1`">
                      {{ getCategoryInfo(item.category).label }}
                    </Badge>
                    <div v-if="item.value && item.value !== item.name" class="mt-1 font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block">
                      {{ item.value }}
                    </div>
                  </div>
                </div>
                <div class="absolute right-full bottom-0 h-px w-screen bg-gray-100" />
                <div class="absolute bottom-0 left-0 h-px w-screen bg-gray-100" />
              </td>
              <td class="hidden py-5 pr-6 sm:table-cell">
                <div class="space-y-1">
                  <div class="text-xs/5 text-gray-500">
                    <span class="font-medium">{{ $t('mcpCatalog.form.configurationSchema.table.properties.type') }}</span> {{ item.dataType }}
                  </div>
                  <div v-if="item.required" class="text-xs/5 text-gray-500">
                    <span class="font-medium">{{ $t('mcpCatalog.form.configurationSchema.table.properties.required') }}</span> {{ $t('mcpCatalog.form.configurationSchema.table.properties.yes') }}
                  </div>
                  <div v-if="item.locked" class="text-xs/5 text-gray-500 flex items-center gap-1">
                    <Lock class="w-3 h-3" />
                    <span class="font-medium">{{ $t('mcpCatalog.form.configurationSchema.table.properties.locked') }}</span>
                  </div>
                </div>
              </td>
              <td class="hidden py-5 pr-6 sm:table-cell">
                <div v-if="item.description" class="text-sm/6 text-gray-900">
                  {{ item.description }}
                </div>
              </td>
              <td class="py-5 text-right">
                <div class="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" class="h-8 w-8 p-0">
                        <span class="sr-only">{{ $t('mcpCatalog.form.configurationSchema.table.actions.openMenu') }}</span>
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="openEditModal(localData.findIndex(i => i.id === item.id))">
                        <Edit class="mr-2 h-4 w-4" />
                        {{ $t('mcpCatalog.form.configurationSchema.table.actions.edit') }}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        @click="handleDelete(localData.findIndex(i => i.id === item.id))"
                        class="text-red-600 focus:text-red-600"
                      >
                        <Trash2 class="mr-2 h-4 w-4" />
                        {{ $t('mcpCatalog.form.configurationSchema.table.actions.delete') }}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Arguments Empty State -->
      <div v-else class="text-center py-12">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
          <Terminal class="h-6 w-6 text-gray-400" />
        </div>
        <h3 class="text-sm font-medium text-gray-900 mb-2">{{ $t('mcpCatalog.form.configurationSchema.arguments.emptyState.title') }}</h3>
        <p class="text-sm text-gray-500 max-w-sm mx-auto">
          {{ $t('mcpCatalog.form.configurationSchema.arguments.emptyState.description') }}
        </p>
      </div>
    </div>

    <!-- Environment Variables Section - Now using shared component -->
    <ConfigurationSchemaEnvironmentSection
      :items="environmentItems"
      :get-category-info="getCategoryInfo"
      @add="handleEnvAdd"
      @edit="handleEnvEdit"
      @delete="handleEnvDelete"
    />

    <!-- Add/Edit Modal -->
    <AlertDialog :open="isModalOpen" @update:open="(value) => isModalOpen = value">
      <AlertDialogContent class="sm:max-w-[600px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ modalTitle }}</AlertDialogTitle>
          <AlertDialogDescription>
            Configure this item for your MCP server.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Name -->
          <div class="space-y-2">
            <Label for="item-name">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.name.label') }}</Label>
            <Input
              id="item-name"
              v-model="formDataLocal.name"
              :placeholder="$t(`mcpCatalog.form.configurationSchema.modal.fields.name.placeholders.${formDataLocal.type === 'arg' ? 'argument' : 'environment'}`)"
              :class="{ 'border-destructive': formErrors.name }"
              class="font-mono"
              required
            />
            <div v-if="formErrors.name" class="text-sm text-destructive">
              {{ formErrors.name }}
            </div>
          </div>

          <!-- Value (for template args only) -->
          <div v-if="formDataLocal.type === 'arg' && formDataLocal.category === 'template'" class="space-y-2">
            <Label for="item-value">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.value.label') }}</Label>
            <Input
              id="item-value"
              v-model="formDataLocal.value"
              :placeholder="$t('mcpCatalog.form.configurationSchema.modal.fields.value.placeholder')"
              :class="{ 'border-destructive': formErrors.value }"
              class="font-mono"
              required
            />
            <div v-if="formErrors.value" class="text-sm text-destructive">
              {{ formErrors.value }}
            </div>
          </div>

          <!-- Category -->
          <div class="space-y-2">
            <Label for="item-category">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.category.label') }}</Label>
            <Select v-model="formDataLocal.category">
              <SelectTrigger>
                <SelectValue :placeholder="$t('mcpCatalog.form.configurationSchema.modal.fields.category.placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in availableCategoryOptions" :key="option.value" :value="option.value">
                  <div class="flex items-center gap-2">
                    <component :is="option.icon" class="w-4 h-4" />
                    {{ option.label.value }}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Data Type -->
          <div v-if="formDataLocal.category !== 'template'" class="space-y-2">
            <Label for="item-type">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.dataType.label') }}</Label>
            <Select v-model="formDataLocal.dataType">
              <SelectTrigger>
                <SelectValue :placeholder="$t('mcpCatalog.form.configurationSchema.modal.fields.dataType.placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in typeOptions" :key="option.value" :value="option.value">
                  {{ option.label.value }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Description -->
          <div class="space-y-2">
            <Label for="item-description">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.description.label') }}</Label>
            <Textarea
              id="item-description"
              v-model="formDataLocal.description"
              :placeholder="$t('mcpCatalog.form.configurationSchema.modal.fields.description.placeholder')"
              rows="2"
            />
          </div>

          <!-- Options -->
          <div class="space-y-3">
            <div class="flex items-center space-x-2" v-if="formDataLocal.category !== 'template'">
              <Switch
                id="item-required"
                :model-value="formDataLocal.required"
                @update:model-value="(value: boolean) => formDataLocal.required = value"
              />
              <Label for="item-required">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.options.required') }}</Label>
            </div>

            <div class="flex items-center space-x-2">
              <Switch
                id="item-locked"
                :model-value="formDataLocal.locked"
                @update:model-value="(value: boolean) => formDataLocal.locked = value"
              />
              <Label for="item-locked">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.options.locked') }}</Label>
            </div>

            <div class="flex items-center space-x-2" v-if="formDataLocal.category === 'team'">
              <Switch
                id="item-default-team-locked"
                :model-value="formDataLocal.default_team_locked"
                @update:model-value="(value: boolean) => formDataLocal.default_team_locked = value"
              />
              <Label for="item-default-team-locked">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.options.defaultTeamLocked') }}</Label>
            </div>

            <div class="flex items-center space-x-2" v-if="formDataLocal.type === 'env' && formDataLocal.category === 'team'">
              <Switch
                id="item-visible-to-users"
                :model-value="formDataLocal.visible_to_users"
                @update:model-value="(value: boolean) => formDataLocal.visible_to_users = value"
              />
              <Label for="item-visible-to-users">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.options.visibleToUsers') }}</Label>
            </div>
          </div>

          <AlertDialogFooter>
            <Button type="button" variant="outline" @click="closeModal">
              {{ $t('mcpCatalog.form.configurationSchema.modal.actions.cancel') }}
            </Button>
            <Button type="submit" :disabled="!isFormValid">
              {{ $t(`mcpCatalog.form.configurationSchema.modal.actions.${modalMode === 'add' ? 'add' : 'update'}`) }}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
