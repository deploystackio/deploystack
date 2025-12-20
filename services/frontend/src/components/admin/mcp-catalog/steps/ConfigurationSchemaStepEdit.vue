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
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { Terminal, Users, User, Plus } from 'lucide-vue-next'
import { DsCard } from '@/components/ui/ds-card'
import ConfigurationSchemaEnvironmentSection from './ConfigurationSchemaEnvironmentSection.vue'
import ConfigurationSchemaHeadersSection from './ConfigurationSchemaHeadersSection.vue'
import ConfigurationSchemaQueryParamsSection from './ConfigurationSchemaQueryParamsSection.vue'
import ConfigurationSchemaArgumentsSection from './ConfigurationSchemaArgumentsSection.vue'

const { t } = useI18n()
const eventBus = useEventBus()

// Storage keys for edit mode
const STORAGE_KEY = 'edit_configuration_schema'
const TECHNICAL_STORAGE_KEY = 'edit_technical_data'

// Define types for our categorized items
type ArgCategory = 'template' | 'team' | 'user'
type EnvCategory = 'team' | 'user'
type HeaderCategory = 'template' | 'team' | 'user'
type QueryParamCategory = 'template' | 'team' | 'user'
type ItemType = 'arg' | 'env' | 'header' | 'query_param'

interface ConfigItem {
  id: string
  type: ItemType
  category: ArgCategory | EnvCategory | HeaderCategory | QueryParamCategory
  name: string
  value?: string // For template args
  description: string
  dataType: string // 'string' | 'number' | 'boolean'
  required: boolean
  locked: boolean
  default_team_locked?: boolean
  visible_to_users?: boolean // For env vars, headers, and query params
  order?: number // For STDIO argument ordering
}

interface ConfigurationSchema {
  template_args?: TemplateArg[]
  template_env?: TemplateEnvVar[]
  template_headers?: TemplateHeaderVar[]
  template_url_query_params?: TemplateUrlQueryParam[]
  team_args_schema?: TeamArgsSchema[]
  team_env_schema?: TeamEnvSchema[]
  team_headers_schema?: TeamHeadersSchema[]
  team_url_query_params_schema?: TeamUrlQueryParamsSchema[]
  user_args_schema?: UserArgsSchema[]
  user_env_schema?: UserEnvSchema[]
  user_headers_schema?: UserHeadersSchema[]
  user_url_query_params_schema?: UserUrlQueryParamsSchema[]
}

interface TemplateArg {
  value: string
  locked: boolean
  description?: string
  order?: number
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

interface TemplateUrlQueryParam {
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
  order?: number
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

interface TeamUrlQueryParamsSchema {
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
  order?: number
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

interface UserUrlQueryParamsSchema {
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

const headerCategoryOptions = [
  { value: 'template', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.template')), icon: Terminal, color: 'blue' },
  { value: 'team', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.team')), icon: Users, color: 'green' },
  { value: 'user', label: computed(() => t('mcpCatalog.form.configurationSchema.categories.user')), icon: User, color: 'purple' },
]

const queryParamCategoryOptions = [
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


// Load data from existing schema in storage
const loadFromStorageSchema = () => {
  const storedSchema = eventBus.getState<ConfigurationSchema>(STORAGE_KEY)
  if (!storedSchema) return

  const items: ConfigItem[] = []

  // Convert template args - these should display the actual argument values
  ;(storedSchema.template_args || []).forEach((arg, index) => {
    items.push({
      id: `template_arg_${index}`,
      type: 'arg',
      category: 'template',
      name: arg.value, // Use the actual value as the name
      value: arg.value, // Keep value for reference
      description: arg.description || `Static argument: ${arg.value}`,
      dataType: 'string',
      required: true,
      locked: arg.locked,
      default_team_locked: false,
      order: (arg as { order?: number }).order ?? index,
    })
  })

  // Convert template headers
  ;(storedSchema.template_headers || []).forEach((header, index) => {
    items.push({
      id: `template_header_${index}`,
      type: 'header',
      category: 'template',
      name: header.name,
      value: header.value,
      description: header.description || `Static header: ${header.name}`,
      dataType: 'string',
      required: true,
      locked: header.locked,
      default_team_locked: false,
    })
  })

  // Convert team args schema - these should display the actual argument values
  ;(storedSchema.team_args_schema || []).forEach((arg, index) => {
    items.push({
      id: `team_arg_${index}`,
      type: 'arg',
      category: 'team',
      name: arg.name, // This should be the actual argument value like "@upstash/context7-mcp"
      description: arg.description || `Team-configurable argument: ${arg.name}`,
      dataType: arg.type || 'string',
      required: arg.required || false,
      locked: arg.locked || false,
      default_team_locked: arg.default_team_locked || false,
      order: (arg as { order?: number }).order ?? index,
    })
  })

  // Convert team headers schema
  ;(storedSchema.team_headers_schema || []).forEach((header, index) => {
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

  // Convert user args schema (these are manually added, not from original parsing)
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
      order: (arg as { order?: number }).order ?? index,
    })
  })

  // Convert user headers schema
  ;(storedSchema.user_headers_schema || []).forEach((header, index) => {
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

  // Convert template URL query params
  ;(storedSchema.template_url_query_params || []).forEach((param, index) => {
    items.push({
      id: `template_query_param_${index}`,
      type: 'query_param',
      category: 'template',
      name: param.name,
      value: param.value,
      description: param.description || '',
      dataType: 'string',
      required: true,
      locked: param.locked,
      default_team_locked: false,
    })
  })

  // Convert team URL query params schema
  ;(storedSchema.team_url_query_params_schema || []).forEach((param, index) => {
    items.push({
      id: `team_query_param_${index}`,
      type: 'query_param',
      category: 'team',
      name: param.name,
      description: param.description || '',
      dataType: param.type || 'string',
      required: param.required || false,
      locked: param.locked || false,
      default_team_locked: param.default_team_locked || false,
      visible_to_users: param.visible_to_users || false,
    })
  })

  // Convert user URL query params schema
  ;(storedSchema.user_url_query_params_schema || []).forEach((param, index) => {
    items.push({
      id: `user_query_param_${index}`,
      type: 'query_param',
      category: 'user',
      name: param.name,
      description: param.description || '',
      dataType: param.type || 'string',
      required: param.required || false,
      locked: param.locked || false,
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
    template_headers: [],
    template_url_query_params: [],
    team_args_schema: [],
    team_env_schema: [],
    team_headers_schema: [],
    team_url_query_params_schema: [],
    user_args_schema: [],
    user_env_schema: [],
    user_headers_schema: [],
    user_url_query_params_schema: [],
  }

  localData.value.forEach(item => {
    if (item.type === 'arg') {
      if (item.category === 'template') {
        schema.template_args!.push({
          value: item.value || '',
          locked: item.locked,
          description: item.description,
          order: item.order
        })
      } else if (item.category === 'team') {
        schema.team_args_schema!.push({
          name: item.name,
          type: item.dataType,
          description: item.description,
          required: item.required,
          locked: item.locked,
          default_team_locked: item.default_team_locked,
          order: item.order
        })
      } else if (item.category === 'user') {
        schema.user_args_schema!.push({
          name: item.name,
          type: item.dataType,
          description: item.description,
          required: item.required,
          locked: item.locked,
          order: item.order
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
    } else if (item.type === 'query_param') {
      if (item.category === 'template') {
        schema.template_url_query_params!.push({
          name: item.name,
          value: item.value || '',
          locked: item.locked,
          description: item.description
        })
      } else if (item.category === 'team') {
        schema.team_url_query_params_schema!.push({
          name: item.name,
          type: item.dataType,
          description: item.description,
          required: item.required,
          locked: item.locked,
          default_team_locked: item.default_team_locked,
          visible_to_users: item.visible_to_users
        })
      } else if (item.category === 'user') {
        schema.user_url_query_params_schema!.push({
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
  const args = localData.value.filter(item => item.type === 'arg')
  // Sort by order to preserve argument order (important for STDIO servers)
  return args.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
})

const environmentItems = computed(() => {
  return localData.value.filter(item => item.type === 'env')
})

const headerItems = computed(() => {
  return localData.value.filter(item => item.type === 'header')
})

const queryParamItems = computed(() => {
  return localData.value.filter(item => item.type === 'query_param')
})

// Check if transport type supports HTTP headers
const isHttpTransport = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const technicalData = eventBus.getState(TECHNICAL_STORAGE_KEY) as any
  if (!technicalData) return false

  const transportType = technicalData.transport_type
  return transportType === 'http' || transportType === 'sse' || transportType === 'streamableHttp'
})

// Get Claude Desktop config preview for display - dynamically built from current argumentItems
const claudeConfigPreview = computed(() => {
  // For HTTP servers, no args preview needed
  if (isHttpTransport.value) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const technicalData = eventBus.getState(TECHNICAL_STORAGE_KEY) as any
  if (!technicalData) return null

  // Build args array from current argumentItems order
  const currentArgs = argumentItems.value.map(item => item.name)

  // Get server name and command from technical data
  const serverName = technicalData.name || 'server'
  const packages = technicalData.packages || []
  const command = packages[0]?.name || 'npx'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    mcpServers: {
      [serverName]: {
        command: command
      }
    }
  }

  if (currentArgs.length > 0) {
    config.mcpServers[serverName].args = currentArgs
  }

  // Add env if present
  const envItems = environmentItems.value
  if (envItems.length > 0) {
    config.mcpServers[serverName].env = {}
    envItems.forEach(item => {
      config.mcpServers[serverName].env[item.name] = item.value || `<${item.name}>`
    })
  }

  try {
    return JSON.stringify(config, null, 2)
  } catch {
    return null
  }
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

  // Set default category based on type
  if (type === 'arg') {
    formDataLocal.value.category = 'template'
  } else if (type === 'env') {
    formDataLocal.value.category = 'team'
  } else if (type === 'header') {
    formDataLocal.value.category = 'template'
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

  // For template args and headers, set both name and value to the same value
  if (newItem.type === 'arg' && newItem.category === 'template') {
    newItem.value = newItem.name
  } else if (newItem.type === 'header' && newItem.category === 'template') {
    // For template headers, if no value is provided, use an empty string
    if (!newItem.value) {
      newItem.value = ''
    }
  }

  if (modalMode.value === 'add') {
    // For new arg items, assign order at the end
    if (newItem.type === 'arg' && newItem.order === undefined) {
      const maxOrder = Math.max(...localData.value.filter(i => i.type === 'arg').map(i => i.order ?? -1), -1)
      newItem.order = maxOrder + 1
    }
    updatedData.push(newItem)
  } else {
    // For edits, preserve the original order
    const existingItem = localData.value[editingIndex.value]
    if (existingItem && newItem.type === 'arg') {
      newItem.order = existingItem.order
    }
    updatedData[editingIndex.value] = newItem
  }

  // Update local data and force immediate storage save
  localData.value = updatedData
  
  // Force synchronous storage update
  isUpdatingFromStorage.value = false
  assembleSchemaAndSave()
  
  closeModal()
}

const handleDelete = (index: number) => {
  const updatedData = localData.value.filter((_, i) => i !== index)
  updateData(updatedData)
}

const updateData = (newData: ConfigItem[]) => {
  localData.value = newData
  isUpdatingFromStorage.value = false
  assembleSchemaAndSave()
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

// Arguments event handlers
const handleArgAdd = () => {
  openAddModal('arg')
}

const handleArgEdit = (index: number) => {
  const argItems = argumentItems.value
  const argItem = argItems[index]
  if (!argItem) return
  const globalIndex = localData.value.findIndex(item => item.id === argItem.id)
  openEditModal(globalIndex)
}

const handleArgDelete = (index: number) => {
  const argItems = argumentItems.value
  const argItem = argItems[index]
  if (!argItem) return
  const globalIndex = localData.value.findIndex(item => item.id === argItem.id)
  handleDelete(globalIndex)
}

const handleArgMoveUp = (index: number) => {
  if (index === 0) return
  const args = argumentItems.value
  const currentItem = args[index]
  const prevItem = args[index - 1]
  if (!currentItem || !prevItem) return

  // Swap order values
  const currentOrder = currentItem.order ?? index
  const prevOrder = prevItem.order ?? (index - 1)

  // Update in localData
  const currentGlobalIndex = localData.value.findIndex(item => item.id === currentItem.id)
  const prevGlobalIndex = localData.value.findIndex(item => item.id === prevItem.id)

  const currentData = localData.value[currentGlobalIndex]
  const prevData = localData.value[prevGlobalIndex]

  if (currentGlobalIndex !== -1 && currentData) {
    currentData.order = prevOrder
  }
  if (prevGlobalIndex !== -1 && prevData) {
    prevData.order = currentOrder
  }

  // Trigger reactivity and save
  localData.value = [...localData.value]
  assembleSchemaAndSave()
}

const handleArgMoveDown = (index: number) => {
  const args = argumentItems.value
  if (index >= args.length - 1) return
  const currentItem = args[index]
  const nextItem = args[index + 1]
  if (!currentItem || !nextItem) return

  // Swap order values
  const currentOrder = currentItem.order ?? index
  const nextOrder = nextItem.order ?? (index + 1)

  // Update in localData
  const currentGlobalIndex = localData.value.findIndex(item => item.id === currentItem.id)
  const nextGlobalIndex = localData.value.findIndex(item => item.id === nextItem.id)

  const currentData = localData.value[currentGlobalIndex]
  const nextData = localData.value[nextGlobalIndex]

  if (currentGlobalIndex !== -1 && currentData) {
    currentData.order = nextOrder
  }
  if (nextGlobalIndex !== -1 && nextData) {
    nextData.order = currentOrder
  }

  // Trigger reactivity and save
  localData.value = [...localData.value]
  assembleSchemaAndSave()
}

// Headers event handlers
const handleHeaderAdd = () => {
  if (!isHttpTransport.value) {
    console.warn('Headers are only available for HTTP transport types')
    return
  }
  openAddModal('header')
}

const handleHeaderEdit = (index: number) => {
  const headerItems = localData.value.filter(item => item.type === 'header')
  const headerItem = headerItems[index]
  if (!headerItem) return
  const globalIndex = localData.value.findIndex(item => item.id === headerItem.id)
  openEditModal(globalIndex)
}

const handleHeaderDelete = (index: number) => {
  const headerItems = localData.value.filter(item => item.type === 'header')
  const headerItem = headerItems[index]
  if (!headerItem) return
  const globalIndex = localData.value.findIndex(item => item.id === headerItem.id)
  handleDelete(globalIndex)
}

// URL Query Parameters event handlers
const handleQueryParamAdd = () => {
  if (!isHttpTransport.value) {
    console.warn('URL query parameters are only available for HTTP transport types')
    return
  }
  openAddModal('query_param')
}

const handleQueryParamEdit = (index: number) => {
  const queryParamItems = localData.value.filter(item => item.type === 'query_param')
  const queryParamItem = queryParamItems[index]
  if (!queryParamItem) return
  const globalIndex = localData.value.findIndex(item => item.id === queryParamItem.id)
  openEditModal(globalIndex)
}

const handleQueryParamDelete = (index: number) => {
  const queryParamItems = localData.value.filter(item => item.type === 'query_param')
  const queryParamItem = queryParamItems[index]
  if (!queryParamItem) return
  const globalIndex = localData.value.findIndex(item => item.id === queryParamItem.id)
  handleDelete(globalIndex)
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
  } else if (formDataLocal.value.type === 'header' && isHttpTransport.value) {
    return headerCategoryOptions
  } else if (formDataLocal.value.type === 'query_param' && isHttpTransport.value) {
    return queryParamCategoryOptions
  }
  return []
})

// Fresh data loading on step entry
const refreshDataOnStepEntry = () => {
  loadFromStorageSchema()

  // Load persisted environment variables from TechnicalStep
  const extractedEnvVars = eventBus.getState<string[]>('technical_extracted_env_vars_edit')

  if (extractedEnvVars && extractedEnvVars.length > 0) {
    handleTechnicalEnvVarsUpdate({ envVars: extractedEnvVars })
  }

  // Load persisted headers from TechnicalStep - DISABLED
  // const extractedHeaders = eventBus.getState<Record<string, string>>('technical_extracted_headers_edit')
  // if (extractedHeaders && Object.keys(extractedHeaders).length > 0 && isHttpTransport.value) {
  //   handleTechnicalHeadersUpdate({ headers: extractedHeaders })
  // }
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

// Handle Headers sync from TechnicalStep
const handleTechnicalHeadersUpdate = () => {
  // DISABLED: Don't automatically add headers from technical step
  // Headers should be managed through the database schema only
  // This prevents conflicts with existing team/user headers
  return
}

onMounted(() => {
  // Initialize with current storage data
  loadFromStorageSchema()

  // Listen for step changes
  eventBus.on('mcp-form-step-changed', handleStepChange)

  // Listen for environment variables updates from TechnicalStep
  eventBus.on('technical-env-vars-updated', handleTechnicalEnvVarsUpdate)

  // Listen for headers updates from TechnicalStep
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventBus.on('technical-headers-updated', handleTechnicalHeadersUpdate as any)

  // Load persisted env vars immediately on mount
  const extractedEnvVars = eventBus.getState<string[]>('technical_extracted_env_vars_edit')
  if (extractedEnvVars && extractedEnvVars.length > 0) {
    handleTechnicalEnvVarsUpdate({ envVars: extractedEnvVars })
  }

  // Load persisted headers immediately on mount - DISABLED
  // const extractedHeaders = eventBus.getState<Record<string, string>>('technical_extracted_headers_edit')
  // if (extractedHeaders && Object.keys(extractedHeaders).length > 0 && isHttpTransport.value) {
  //   handleTechnicalHeadersUpdate({ headers: extractedHeaders })
  // }
})

onUnmounted(() => {
  eventBus.off('mcp-form-step-changed', handleStepChange)
  eventBus.off('technical-env-vars-updated', handleTechnicalEnvVarsUpdate)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventBus.off('technical-headers-updated', handleTechnicalHeadersUpdate as any)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Arguments Section - Only show for STDIO servers -->
    <DsCard v-if="!isHttpTransport" :title="$t('mcpCatalog.form.configurationSchema.arguments.title')">
      <ConfigurationSchemaArgumentsSection
        :items="argumentItems"
        :get-category-info="getCategoryInfo"
        @edit="handleArgEdit"
        @delete="handleArgDelete"
        @move-up="handleArgMoveUp"
        @move-down="handleArgMoveDown"
      />

      <!-- Claude Desktop Config Preview -->
      <div v-if="claudeConfigPreview" class="space-y-2 mt-4">
        <h4 class="text-sm font-medium text-muted-foreground">
          {{ $t('mcpCatalog.form.configurationSchema.preview.title') }}
        </h4>
        <pre class="p-3 bg-muted rounded-md text-xs overflow-x-auto"><code>{{ claudeConfigPreview }}</code></pre>
      </div>

      <template #footer-actions>
        <Button @click="handleArgAdd">
          <Plus class="h-4 w-4 mr-2" />
          {{ $t('mcpCatalog.form.configurationSchema.arguments.addButton') }}
        </Button>
      </template>
    </DsCard>

    <!-- Environment Variables Section - Only show for STDIO servers -->
    <DsCard v-if="!isHttpTransport" :title="$t('mcpCatalog.form.configurationSchema.environment.title')">
      <ConfigurationSchemaEnvironmentSection
        :items="environmentItems"
        :get-category-info="getCategoryInfo"
        @edit="handleEnvEdit"
        @delete="handleEnvDelete"
      />

      <template #footer-actions>
        <Button @click="handleEnvAdd">
          <Plus class="h-4 w-4 mr-2" />
          {{ $t('mcpCatalog.form.configurationSchema.environment.addButton') }}
        </Button>
      </template>
    </DsCard>

    <!-- Headers Section - Only show for HTTP servers -->
    <DsCard v-if="isHttpTransport" :title="$t('mcpCatalog.form.configurationSchema.headers.title')">
      <ConfigurationSchemaHeadersSection
        :items="headerItems"
        :get-category-info="getCategoryInfo"
        @edit="handleHeaderEdit"
        @delete="handleHeaderDelete"
      />

      <template #footer-actions>
        <Button @click="handleHeaderAdd">
          <Plus class="h-4 w-4 mr-2" />
          {{ $t('mcpCatalog.form.configurationSchema.headers.addButton') }}
        </Button>
      </template>
    </DsCard>

    <!-- URL Query Parameters Section - Only show for HTTP servers -->
    <DsCard v-if="isHttpTransport" :title="$t('mcpCatalog.form.configurationSchema.urlQueryParams.title')">
      <ConfigurationSchemaQueryParamsSection
        :items="queryParamItems"
        :get-category-info="getCategoryInfo"
        @edit="handleQueryParamEdit"
        @delete="handleQueryParamDelete"
      />

      <template #footer-actions>
        <Button @click="handleQueryParamAdd">
          <Plus class="h-4 w-4 mr-2" />
          {{ $t('mcpCatalog.form.configurationSchema.urlQueryParams.addButton') }}
        </Button>
      </template>
    </DsCard>

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
          <!-- Name Field -->
          <div class="space-y-2">
            <Label for="item-name">
              <span v-if="formDataLocal.type === 'arg'">Argument</span>
              <span v-else-if="formDataLocal.type === 'env'">Environment Variable</span>
              <span v-else-if="formDataLocal.type === 'header'">Header Name</span>
              <span v-else-if="formDataLocal.type === 'query_param'">Query Parameter Name</span>
            </Label>
            <Input
              id="item-name"
              v-model="formDataLocal.name"
              :placeholder="formDataLocal.type === 'arg' ? 'e.g. --api-key or -y' : formDataLocal.type === 'env' ? 'e.g. API_KEY' : formDataLocal.type === 'header' ? 'e.g. Authorization' : 'e.g. api_key'"
              :class="{ 'border-destructive': formErrors.name }"
              class="font-mono"
              required
            />
            <div v-if="formErrors.name" class="text-sm text-destructive">
              {{ formErrors.name }}
            </div>
          </div>

          <!-- Value Field (only for template category) -->
          <div v-if="formDataLocal.category === 'template' && formDataLocal.type === 'header'" class="space-y-2">
            <Label for="item-value">Header Value</Label>
            <Input
              id="item-value"
              v-model="formDataLocal.value"
              :placeholder="'e.g. Bearer YOUR_TOKEN'"
              class="font-mono"
            />
          </div>

          <div v-if="formDataLocal.category === 'template' && formDataLocal.type === 'query_param'" class="space-y-2">
            <Label for="item-value">Query Parameter Value</Label>
            <Input
              id="item-value"
              v-model="formDataLocal.value"
              :placeholder="'e.g. your_api_key_here'"
              class="font-mono"
            />
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

            <div class="flex items-center space-x-2" v-if="(formDataLocal.type === 'env' || formDataLocal.type === 'header' || formDataLocal.type === 'query_param') && formDataLocal.category === 'team'">
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
