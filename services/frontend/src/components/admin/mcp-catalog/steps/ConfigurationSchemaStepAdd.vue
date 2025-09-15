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

import { Plus, Edit, Trash2, MoreHorizontal, Terminal, Users, User, Lock, Globe } from 'lucide-vue-next'
import ConfigurationSchemaEnvironmentSection from './ConfigurationSchemaEnvironmentSection.vue'

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

// Define types for our categorized items
type ArgCategory = 'template' | 'team' | 'user'
type EnvCategory = 'team' | 'user'
type HeaderCategory = 'team' | 'user'
type ItemType = 'arg' | 'env' | 'header'

interface ConfigItem {
  id: string
  type: ItemType
  category: ArgCategory | EnvCategory | HeaderCategory
  name: string
  value?: string // For template args
  description: string
  dataType: string // 'string' | 'number' | 'boolean'
  required: boolean
  locked: boolean
  default_team_locked?: boolean
  visible_to_users?: boolean // For env vars and headers
}

interface ConfigurationSchema {
  template_args?: TemplateArg[]
  template_env?: TemplateEnvVar[]
  template_headers?: TemplateHeaderVar[]
  team_args_schema?: TeamArgsSchema[]
  team_env_schema?: TeamEnvSchema[]
  team_headers_schema?: TeamHeadersSchema[]
  user_args_schema?: UserArgsSchema[]
  user_env_schema?: UserEnvSchema[]
  user_headers_schema?: UserHeadersSchema[]
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

interface TemplateHeaderVar {
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

interface TeamHeadersSchema {
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

interface UserHeadersSchema {
  name: string
  type: string
  description?: string
  required: boolean
  locked: boolean
}

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

// Removed envCategoryOptions - now handled by shared component

const typeOptions = [
  { value: 'string', label: computed(() => t('mcpCatalog.form.configurationSchema.dataTypes.string')) },
  { value: 'number', label: computed(() => t('mcpCatalog.form.configurationSchema.dataTypes.number')) },
  { value: 'boolean', label: computed(() => t('mcpCatalog.form.configurationSchema.dataTypes.boolean')) },
  { value: 'secret', label: computed(() => t('mcpCatalog.form.configurationSchema.dataTypes.secret')) },
]

// Placeholder detection for team-configurable values (still needed for env vars)
const isPlaceholderValue = (value: string): boolean => {
  const placeholderPatterns = [
    /^YOUR_[A-Z_]+$/,           // YOUR_API_KEY, YOUR_TOKEN
    /^[A-Z_]+_KEY$/,            // API_KEY, ACCESS_KEY
    /^[A-Z_]+_TOKEN$/,          // AUTH_TOKEN, ACCESS_TOKEN
    /^[A-Z_]+_SECRET$/,         // CLIENT_SECRET, API_SECRET
    /^<[^>]+>$/,                // <API_KEY>, <YOUR_TOKEN>
    /^\{[^}]+\}$/,              // {API_KEY}, {YOUR_TOKEN}
    /^\$\{[^}]+\}$/,            // ${API_KEY}, ${YOUR_TOKEN}
    /^REPLACE_WITH_/,           // REPLACE_WITH_YOUR_KEY
    /^CHANGE_ME/,               // CHANGE_ME, CHANGE_ME_API_KEY
  ]
  return placeholderPatterns.some(pattern => pattern.test(value))
}

// Simple args parsing - first 2 are template, rest are team configurable
const parseArgsIntelligently = (rawArgs: string[]): ConfigItem[] => {
  const items: ConfigItem[] = []

  rawArgs.forEach((arg, index) => {
    // Skip if arg is undefined
    if (!arg) return

    // First 2 arguments are always template (static)
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
    }
    // All other arguments are team configurable
    else {
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

// Detect if server config is URL-based vs command-based
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isUrlBasedServer = (serverConfig: any): boolean => {
  return !!serverConfig.url && !!serverConfig.type
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

  // Check if this is a URL-based server or command-based server
  if (isUrlBasedServer(serverConfig)) {
    // Handle URL-based servers (like Context7)
    
    // Add URL as a template argument (static)
    if (serverConfig.url) {
      items.push({
        id: 'template_url',
        type: 'arg',
        category: 'template',
        name: 'url',
        value: serverConfig.url,
        description: `Server URL: ${serverConfig.url}`,
        dataType: 'string',
        required: true,
        locked: true,
        default_team_locked: false,
      })
    }
    
    // Add type as a template argument (static)
    if (serverConfig.type) {
      items.push({
        id: 'template_type',
        type: 'arg',
        category: 'template',
        name: 'type',
        value: serverConfig.type,
        description: `Server type: ${serverConfig.type}`,
        dataType: 'string',
        required: true,
        locked: true,
        default_team_locked: false,
      })
    }
    
    // Process headers (similar to env vars)
    const rawHeaders = serverConfig.headers || {}
    const headerItems = parseHeadersIntelligently(rawHeaders)
    items.push(...headerItems)
    
  } else {
    // Handle command-based servers (existing logic)
    
    // Process args with intelligent parsing
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

// Load data from existing schema (when modelValue is provided)
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

  // Convert team args schema
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

  // Convert user args schema
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

  // Convert team env schema
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

  // Convert user env schema
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

  // Convert template headers
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

  // Convert team headers schema
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

  // Convert user headers schema
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
const argumentItems = computed(() => {
  return localData.value.filter(item => item.type === 'arg')
})

const environmentItems = computed(() => {
  return localData.value.filter(item => item.type === 'env')
})

const headerItems = computed(() => {
  return localData.value.filter(item => item.type === 'header')
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
  let typeKey = 'argument'
  if (formDataLocal.value.type === 'env') {
    typeKey = 'environment'
  } else if (formDataLocal.value.type === 'header') {
    typeKey = 'header'
  }
  return t(`mcpCatalog.form.configurationSchema.modal.${modalKey}.${typeKey}`)
})

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

// Headers event handlers
const handleHeaderAdd = () => {
  openAddModal('header')
}

const handleHeaderEdit = (index: number) => {
  const headerItems_ = headerItems.value
  const headerItem = headerItems_[index]
  if (!headerItem) return
  const globalIndex = localData.value.findIndex(item => item.id === headerItem.id)
  openEditModal(globalIndex)
}

const handleHeaderDelete = (index: number) => {
  const headerItems_ = headerItems.value
  const headerItem = headerItems_[index]
  if (!headerItem) return
  const globalIndex = localData.value.findIndex(item => item.id === headerItem.id)
  handleDelete(globalIndex)
}

// Initialize data on mount
onMounted(() => {
  // Load from existing schema first
  if (props.modelValue && Object.keys(props.modelValue).length > 0) {
    loadFromExistingSchema()
  }
  // If no existing schema and we have Claude config, parse it
  else if (localData.value.length === 0 && props.claudeConfig?.claude_desktop_config?.mcpServers) {
    parseFromClaudeConfig()
  }
})

// Watch for changes in Claude config (only if no existing data)
watch(() => props.claudeConfig, () => {
  if (localData.value.length === 0 && props.claudeConfig?.claude_desktop_config?.mcpServers) {
    parseFromClaudeConfig()
  }
}, { deep: true })

// Watch for changes in modelValue (external updates only)
watch(() => props.modelValue, (newVal, oldVal) => {
  // Only load if this is an external change (not from our own emit)
  if (!isInternalUpdate.value && newVal && Object.keys(newVal).length > 0 && newVal !== oldVal) {
    loadFromExistingSchema()
  }
}, { deep: true })

// Watch localData changes to emit updates (debounced)
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

    <!-- Headers Configuration Section -->
    <div class="space-y-4" v-if="headerItems.length > 0 || localData.some(item => item.type === 'header')">
      <div>
        <h4 class="text-md font-medium">{{ $t('mcpCatalog.form.configurationSchema.headers.title') }}</h4>
        <p class="text-sm text-muted-foreground">
          {{ $t('mcpCatalog.form.configurationSchema.headers.description') }}
        </p>
      </div>

      <!-- Header with Add Button -->
      <div class="flex items-center justify-between">
        <div></div>
        <Button
          type="button"
          @click="handleHeaderAdd"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ $t('mcpCatalog.form.configurationSchema.headers.addButton') }}
        </Button>
      </div>

      <!-- Headers Display with Edit Actions -->
      <div v-if="headerItems.length > 0" class="overflow-hidden">
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
            <tr v-for="(item) in headerItems" :key="item.id">
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
                      <DropdownMenuItem @click="handleHeaderEdit(headerItems.findIndex(i => i.id === item.id))">
                        <Edit class="mr-2 h-4 w-4" />
                        {{ $t('mcpCatalog.form.configurationSchema.table.actions.edit') }}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        @click="handleHeaderDelete(headerItems.findIndex(i => i.id === item.id))"
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

      <!-- Headers Empty State -->
      <div v-else class="text-center py-12">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
          <Globe class="h-6 w-6 text-gray-400" />
        </div>
        <h3 class="text-sm font-medium text-gray-900 mb-2">{{ $t('mcpCatalog.form.configurationSchema.headers.emptyState.title') }}</h3>
        <p class="text-sm text-gray-500 max-w-sm mx-auto">
          {{ $t('mcpCatalog.form.configurationSchema.headers.emptyState.description') }}
        </p>
      </div>
    </div>

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
          <!-- Argument/Environment Variable/Header Name -->
          <div class="space-y-2">
            <Label for="item-name">
              {{ 
                formDataLocal.type === 'arg' 
                  ? $t('mcpCatalog.form.configurationSchema.modal.fields.argument.label') 
                  : formDataLocal.type === 'env'
                    ? $t('mcpCatalog.form.configurationSchema.modal.fields.name.label')
                    : $t('mcpCatalog.form.configurationSchema.modal.fields.headerName.label')
              }}
            </Label>
            <Input
              id="item-name"
              v-model="formDataLocal.name"
              :placeholder="
                formDataLocal.type === 'arg' 
                  ? $t('mcpCatalog.form.configurationSchema.modal.fields.argument.placeholder') 
                  : formDataLocal.type === 'env'
                    ? $t('mcpCatalog.form.configurationSchema.modal.fields.name.placeholders.environment')
                    : $t('mcpCatalog.form.configurationSchema.modal.fields.name.placeholders.header')
              "
              :class="{ 'border-destructive': formErrors.name }"
              class="font-mono"
              required
            />
            <div v-if="formErrors.name" class="text-sm text-destructive">
              {{ formErrors.name }}
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

            <div class="flex items-center space-x-2" v-if="(formDataLocal.type === 'env' || formDataLocal.type === 'header') && formDataLocal.category === 'team'">
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
