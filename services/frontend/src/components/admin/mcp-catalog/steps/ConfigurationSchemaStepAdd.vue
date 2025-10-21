<!--
 * ADD MODE CONFIGURATION SCHEMA STEP
 *
 * This component follows the ADD wizard architecture:
 * - Uses v-model and props exclusively
 * - No storage or event bus for data management
 * - Pure Vue reactivity patterns
 * - Receives data through props, emits changes via update:modelValue
 -->

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Terminal, Users, User, Globe } from 'lucide-vue-next'
import ConfigurationSchemaEnvironmentSection from './ConfigurationSchemaEnvironmentSection.vue'
import ConfigurationSchemaHeadersSection from './ConfigurationSchemaHeadersSection.vue'
import ConfigurationSchemaArgumentsSection from './ConfigurationSchemaArgumentsSection.vue'
import ConfigItemModal from './ConfigurationSchemaStepAdd/ConfigItemModal.vue'
import type {
  ConfigItem,
  ConfigurationSchema,
  ItemType
} from './ConfigurationSchemaStepAdd/types'

// Component props interface
interface Props {
  modelValue: object
  claudeConfig?: {
    claude_desktop_config?: {
      mcpServers?: {
        [key: string]: {
          args?: string[]
          env?: Record<string, string>
          url?: string
          type?: string
          headers?: Record<string, string>
        }
      }
    }
  }
}

const props = withDefaults(defineProps<Props>(), {
  claudeConfig: () => ({ claude_desktop_config: { mcpServers: {} } })
})

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

// Local reactive data - pure v-model approach
const localData = ref<ConfigItem[]>([])

// Internal update flag to prevent circular emissions
const isInternalUpdate = ref(false)

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

const typeOptions = [
  { value: 'string', label: computed(() => t('mcpCatalog.form.configurationSchema.dataTypes.string')) },
  { value: 'number', label: computed(() => t('mcpCatalog.form.configurationSchema.dataTypes.number')) },
  { value: 'boolean', label: computed(() => t('mcpCatalog.form.configurationSchema.dataTypes.boolean')) },
  { value: 'secret', label: computed(() => t('mcpCatalog.form.configurationSchema.dataTypes.secret')) },
]

// Detect if server config is URL-based vs command-based
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isUrlBasedServer = (serverConfig: any): boolean => {
  return !!serverConfig.url && !!serverConfig.type
}

// Detect if server is HTTP/SSE-based from Claude config
const isHttpBasedServer = computed(() => {
  const config = props.claudeConfig?.claude_desktop_config?.mcpServers
  if (!config) return false

  const serverConfig = Object.values(config)[0]
  if (!serverConfig) return false

  return isUrlBasedServer(serverConfig)
})

// Placeholder detection for team-configurable values
const isPlaceholderValue = (value: string): boolean => {
  const placeholderPatterns = [
    /^YOUR_[A-Z_]+$/,
    /^[A-Z_]+_KEY$/,
    /^[A-Z_]+_TOKEN$/,
    /^[A-Z_]+_SECRET$/,
    /^<[^>]+>$/,
    /^\{[^}]+\}$/,
    /^\$\{[^}]+\}$/,
    /^REPLACE_WITH_/,
    /^CHANGE_ME/,
  ]
  return placeholderPatterns.some(pattern => pattern.test(value))
}

// Simple args parsing - first 2 are template, rest are team configurable
const parseArgsIntelligently = (rawArgs: string[]): ConfigItem[] => {
  const items: ConfigItem[] = []

  rawArgs.forEach((arg, index) => {
    if (!arg) return

    if (index < 2) {
      items.push({
        id: `template_arg_${index}`,
        type: 'arg',
        category: 'template',
        name: arg,
        value: arg,
        description: `Static argument: ${arg}`,
        dataType: 'string',
        required: true,
        locked: true,
        default_team_locked: false,
      })
    } else {
      items.push({
        id: `team_arg_${index}`,
        type: 'arg',
        category: 'team',
        name: arg,
        value: undefined,
        description: `Team-configurable argument: ${arg}`,
        dataType: 'string',
        required: true,
        locked: false,
        default_team_locked: true,
      })
    }
  })

  return items
}

// Parse headers for URL-based servers
const parseHeadersIntelligently = (rawHeaders: Record<string, string>): ConfigItem[] => {
  const items: ConfigItem[] = []

  Object.entries(rawHeaders).forEach(([key, value]) => {
    const isPlaceholder = isPlaceholderValue(value)
    items.push({
      id: `header_${key}`,
      type: 'header',
      category: isPlaceholder ? 'team' : 'user',
      name: key,
      value: value,
      description: isPlaceholder
        ? `Team-configurable header (placeholder: ${value})`
        : `Header configuration`,
      dataType: value.toLowerCase().includes('bearer') || key.toLowerCase().includes('auth') ? 'secret' : 'string',
      required: true,
      locked: false,
      default_team_locked: isPlaceholder,
      visible_to_users: !isPlaceholder,
    })
  })

  return items
}

// Parse and categorize items from Claude Desktop config
const parseFromClaudeConfig = () => {
  const config = props.claudeConfig?.claude_desktop_config?.mcpServers
  if (!config) return

  const serverConfig = Object.values(config)[0]
  if (!serverConfig) return

  const items: ConfigItem[] = []

  if (isUrlBasedServer(serverConfig)) {
    // Handle URL-based servers
    // For HTTP/Remote servers, url and type go into remotes array, NOT args
    // Only process headers for HTTP servers
    const rawHeaders = serverConfig.headers || {}
    const headerItems = parseHeadersIntelligently(rawHeaders)
    items.push(...headerItems)

  } else {
    // Handle command-based servers
    const rawArgs = serverConfig.args || []
    const argItems = parseArgsIntelligently(rawArgs)
    items.push(...argItems)
  }

  // Process envs (common to both types)
  const rawEnvs = serverConfig.env || {}
  Object.entries(rawEnvs).forEach(([key, value]) => {
    const isPlaceholder = isPlaceholderValue(value)
    items.push({
      id: `env_${key}`,
      type: 'env',
      category: isPlaceholder ? 'team' : 'user',
      name: key,
      value: value,
      description: isPlaceholder
        ? `Team-configurable environment variable (placeholder: ${value})`
        : `User-configurable environment variable`,
      dataType: 'string',
      required: true,
      locked: false,
      default_team_locked: isPlaceholder,
      visible_to_users: !isPlaceholder,
    })
  })

  isInternalUpdate.value = true
  localData.value = items
  nextTick(() => {
    isInternalUpdate.value = false
    emitModelValue()
  })
}

// Load data from existing schema
const loadFromExistingSchema = () => {
  const schema = props.modelValue as ConfigurationSchema
  if (!schema) return

  const items: ConfigItem[] = []

  // Convert template args
  ;(schema.template_args || []).forEach((arg, index) => {
    items.push({
      id: `template_arg_${index}`,
      type: 'arg',
      category: 'template',
      name: arg.value,
      value: arg.value,
      description: arg.description || '',
      dataType: 'string',
      required: true,
      locked: arg.locked,
      default_team_locked: false,
    })
  })

  // Convert team/user args schema
  ;(schema.team_args_schema || []).forEach((arg, index) => {
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

  ;(schema.user_args_schema || []).forEach((arg, index) => {
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

  // Convert env schema
  ;(schema.team_env_schema || []).forEach((env, index) => {
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

  ;(schema.user_env_schema || []).forEach((env, index) => {
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

  // Convert headers schema
  ;(schema.template_headers || []).forEach((header, index) => {
    items.push({
      id: `template_header_${index}`,
      type: 'header',
      category: 'template',
      name: header.name,
      value: header.value,
      description: header.description || '',
      dataType: 'string',
      required: true,
      locked: header.locked,
      default_team_locked: false,
    })
  })

  ;(schema.team_headers_schema || []).forEach((header, index) => {
    items.push({
      id: `team_header_${index}`,
      type: 'header',
      category: 'team',
      name: header.name,
      description: header.description || '',
      dataType: header.type || 'string',
      required: header.required || false,
      locked: header.locked || false,
      default_team_locked: header.default_team_locked || false,
      visible_to_users: header.visible_to_users || false,
    })
  })

  ;(schema.user_headers_schema || []).forEach((header, index) => {
    items.push({
      id: `user_header_${index}`,
      type: 'header',
      category: 'user',
      name: header.name,
      description: header.description || '',
      dataType: header.type || 'string',
      required: header.required || false,
      locked: header.locked || false,
    })
  })

  isInternalUpdate.value = true
  localData.value = items
  nextTick(() => {
    isInternalUpdate.value = false
  })
}

// Assemble the final configuration_schema object and emit
const assembleSchemaAndEmit = () => {
  const schema: ConfigurationSchema = {
    template_args: [],
    template_env: [],
    template_headers: [],
    team_args_schema: [],
    team_env_schema: [],
    team_headers_schema: [],
    user_args_schema: [],
    user_env_schema: [],
    user_headers_schema: [],
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
    } else if (item.type === 'header') {
      if (item.category === 'template') {
        schema.template_headers!.push({
          name: item.name,
          value: item.value || '',
          locked: item.locked,
          description: item.description
        })
      } else if (item.category === 'team') {
        schema.team_headers_schema!.push({
          name: item.name,
          type: item.dataType,
          description: item.description,
          required: item.required,
          locked: item.locked,
          default_team_locked: item.default_team_locked,
          visible_to_users: item.visible_to_users
        })
      } else if (item.category === 'user') {
        schema.user_headers_schema!.push({
          name: item.name,
          type: item.dataType,
          description: item.description,
          required: item.required,
          locked: item.locked
        })
      }
    }
  })

  emit('update:modelValue', schema)
}

// Emit helper for v-model pattern
const emitModelValue = () => {
  if (isInternalUpdate.value) return
  assembleSchemaAndEmit()
}

// Computed properties
const argumentItems = computed(() => localData.value.filter(item => item.type === 'arg'))
const environmentItems = computed(() => localData.value.filter(item => item.type === 'env'))
const headerItems = computed(() => localData.value.filter(item => item.type === 'header'))

const isFormValid = computed(() => {
  return formDataLocal.value.name.trim() !== '' && Object.keys(formErrors.value).length === 0
})

// Modal management
const openAddModal = (type: ItemType) => {
  modalMode.value = 'add'
  editingIndex.value = -1
  resetForm()
  formDataLocal.value.type = type
  if (type === 'arg') {
    formDataLocal.value.category = 'template'
  } else if (type === 'env') {
    formDataLocal.value.category = 'team'
  } else if (type === 'header') {
    formDataLocal.value.category = 'team'
  }
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
    const isDuplicate = localData.value.some((item, index) =>
      item.name === formDataLocal.value.name &&
      item.type === formDataLocal.value.type &&
      index !== editingIndex.value
    )
    if (isDuplicate) {
      errors.name = t('mcpCatalog.form.configurationSchema.modal.validation.nameExists')
    }
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

  localData.value = updatedData
  nextTick(() => {
    emitModelValue()
  })
  closeModal()
}

const handleDelete = (index: number) => {
  localData.value = localData.value.filter((_, i) => i !== index)
  nextTick(() => {
    emitModelValue()
  })
}

// Get category info for display
const getCategoryInfo = (category: string) => {
  const allOptions = [...argCategoryOptions,
    { value: 'team', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.team')), icon: Users, color: 'green' },
    { value: 'user', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.user')), icon: User, color: 'purple' },
  ]
  const found = allOptions.find(opt => opt.value === category)
  if (found) {
    return {
      ...found,
      label: found.label.value
    }
  }
  return {
    value: 'template',
    label: t('mcpCatalog.form.configurationSchema.categories.template'),
    icon: Terminal,
    color: 'blue'
  }
}

// Get available category options for current type
const availableCategoryOptions = computed(() => {
  if (formDataLocal.value.type === 'arg') {
    return argCategoryOptions
  } else if (formDataLocal.value.type === 'env') {
    return [
      { value: 'team', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.team')), icon: Users, color: 'green' },
      { value: 'user', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.user')), icon: User, color: 'purple' },
    ]
  } else if (formDataLocal.value.type === 'header') {
    return [
      { value: 'team', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.team')), icon: Users, color: 'green' },
      { value: 'user', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.user')), icon: User, color: 'purple' },
    ]
  }
  return argCategoryOptions
})

// Event handlers for child components
const handleArgAdd = () => openAddModal('arg')
const handleArgEdit = (index: number) => {
  const argItem = argumentItems.value[index]
  if (!argItem) return
  const globalIndex = localData.value.findIndex(item => item.id === argItem.id)
  openEditModal(globalIndex)
}
const handleArgDelete = (index: number) => {
  const argItem = argumentItems.value[index]
  if (!argItem) return
  const globalIndex = localData.value.findIndex(item => item.id === argItem.id)
  handleDelete(globalIndex)
}

const handleEnvAdd = () => openAddModal('env')
const handleEnvEdit = (index: number) => {
  const envItem = environmentItems.value[index]
  if (!envItem) return
  const globalIndex = localData.value.findIndex(item => item.id === envItem.id)
  openEditModal(globalIndex)
}
const handleEnvDelete = (index: number) => {
  const envItem = environmentItems.value[index]
  if (!envItem) return
  const globalIndex = localData.value.findIndex(item => item.id === envItem.id)
  handleDelete(globalIndex)
}

const handleHeaderAdd = () => openAddModal('header')
const handleHeaderEdit = (index: number) => {
  const headerItem = headerItems.value[index]
  if (!headerItem) return
  const globalIndex = localData.value.findIndex(item => item.id === headerItem.id)
  openEditModal(globalIndex)
}
const handleHeaderDelete = (index: number) => {
  const headerItem = headerItems.value[index]
  if (!headerItem) return
  const globalIndex = localData.value.findIndex(item => item.id === headerItem.id)
  handleDelete(globalIndex)
}

const updateFormData = (updates: Partial<ConfigItem>) => {
  formDataLocal.value = { ...formDataLocal.value, ...updates }
}

// Initialize data on mount
onMounted(() => {
  if (props.modelValue && Object.keys(props.modelValue).length > 0) {
    loadFromExistingSchema()
  } else if (localData.value.length === 0 && props.claudeConfig?.claude_desktop_config?.mcpServers) {
    parseFromClaudeConfig()
  }
})

// Watch for changes
watch(() => props.claudeConfig, () => {
  if (localData.value.length === 0 && props.claudeConfig?.claude_desktop_config?.mcpServers) {
    parseFromClaudeConfig()
  }
}, { deep: true })

watch(() => props.modelValue, (newVal, oldVal) => {
  if (!isInternalUpdate.value && newVal && Object.keys(newVal).length > 0 && newVal !== oldVal) {
    loadFromExistingSchema()
  }
}, { deep: true })

watch(localData, () => {
  if (!isInternalUpdate.value) {
    nextTick(() => {
      emitModelValue()
    })
  }
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <!-- Server Type Indicator -->
    <div v-if="isHttpBasedServer" class="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <Globe class="h-4 w-4 text-blue-600" />
      <span class="text-sm font-medium text-blue-900">
        {{ $t('mcpCatalog.form.configurationSchema.serverTypeIndicator.http') }}
      </span>
    </div>
    <div v-else class="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
      <Terminal class="h-4 w-4 text-green-600" />
      <span class="text-sm font-medium text-green-900">
        {{ $t('mcpCatalog.form.configurationSchema.serverTypeIndicator.stdio') }}
      </span>
    </div>

    <!-- Arguments Section - Only show for STDIO servers -->
    <ConfigurationSchemaArgumentsSection
      v-if="!isHttpBasedServer"
      :items="argumentItems"
      :get-category-info="getCategoryInfo"
      @add="handleArgAdd"
      @edit="handleArgEdit"
      @delete="handleArgDelete"
    />

    <!-- Environment Variables Section - Only show for STDIO servers -->
    <ConfigurationSchemaEnvironmentSection
      v-if="!isHttpBasedServer"
      :items="environmentItems"
      :get-category-info="getCategoryInfo"
      @add="handleEnvAdd"
      @edit="handleEnvEdit"
      @delete="handleEnvDelete"
    />

    <!-- Headers Configuration Section - Always show for HTTP servers -->
    <ConfigurationSchemaHeadersSection
      v-if="isHttpBasedServer"
      :items="headerItems"
      :get-category-info="getCategoryInfo"
      @add="handleHeaderAdd"
      @edit="handleHeaderEdit"
      @delete="handleHeaderDelete"
    />

    <!-- Add/Edit Modal -->
    <ConfigItemModal
      :open="isModalOpen"
      :mode="modalMode"
      :form-data="formDataLocal"
      :form-errors="formErrors"
      :is-form-valid="isFormValid"
      :available-category-options="availableCategoryOptions"
      :type-options="typeOptions"
      @update:open="(value) => isModalOpen = value"
      @update:form-data="updateFormData"
      @submit="handleSubmit"
      @cancel="closeModal"
    />
  </div>
</template>
