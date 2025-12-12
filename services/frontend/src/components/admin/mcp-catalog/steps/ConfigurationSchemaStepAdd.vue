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
import { Terminal, Users, User, Plus } from 'lucide-vue-next'
import { DsCard } from '@/components/ui/ds-card'
import { Button } from '@/components/ui/button'
import ConfigurationSchemaEnvironmentSection from './ConfigurationSchemaEnvironmentSection.vue'
import ConfigurationSchemaHeadersSection from './ConfigurationSchemaHeadersSection.vue'
import ConfigurationSchemaQueryParamsSection from './ConfigurationSchemaQueryParamsSection.vue'
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
          command?: string
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
  visible_to_users: true
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
        order: index,
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
        order: index,
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

// Parse URL query parameters for URL-based servers
const parseQueryParamsIntelligently = (url: string): ConfigItem[] => {
  const items: ConfigItem[] = []

  try {
    const urlObj = new URL(url)
    const params = urlObj.searchParams

    params.forEach((value, key) => {
      const isPlaceholder = isPlaceholderValue(value)
      const isSecret = /^(.*_)?(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)(_.*)?$/i.test(key) ||
                       /^(.*_)?(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)(_.*)?$/i.test(value)

      items.push({
        id: `query_param_${key}`,
        type: 'query_param',
        category: isPlaceholder ? 'team' : 'user',
        name: key,
        value: value,
        description: isPlaceholder
          ? `Team-configurable query parameter (placeholder: ${value})`
          : `Query parameter configuration`,
        dataType: isSecret ? 'secret' : 'string',
        required: true,
        locked: false,
        default_team_locked: false,
        visible_to_users: true,
      })
    })
  } catch (error) {
    // Invalid URL, skip query param parsing
    console.warn('Could not parse URL for query parameters:', error)
  }

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

    // Parse URL query parameters
    if (serverConfig.url) {
      const queryParamItems = parseQueryParamsIntelligently(serverConfig.url)
      items.push(...queryParamItems)
    }

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
      order: arg.order ?? index,
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
      order: arg.order,
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
      order: arg.order,
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

  // Load URL query params
  ;(schema.template_url_query_params || []).forEach((param, index) => {
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

  ;(schema.team_url_query_params_schema || []).forEach((param, index) => {
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

  ;(schema.user_url_query_params_schema || []).forEach((param, index) => {
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

  emit('update:modelValue', schema)
}

// Emit helper for v-model pattern
const emitModelValue = () => {
  if (isInternalUpdate.value) return
  assembleSchemaAndEmit()
}

// Computed properties
const argumentItems = computed(() => {
  const args = localData.value.filter(item => item.type === 'arg')
  // Sort by order to preserve original argument order (important for STDIO servers)
  return args.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
})
const environmentItems = computed(() => localData.value.filter(item => item.type === 'env'))
const headerItems = computed(() => localData.value.filter(item => item.type === 'header'))
const queryParamItems = computed(() => localData.value.filter(item => item.type === 'query_param'))

// Get Claude Desktop config preview for display - reflects current argument order
const claudeConfigPreview = computed(() => {
  const originalConfig = props.claudeConfig?.claude_desktop_config
  if (!originalConfig?.mcpServers) return null

  const serverName = Object.keys(originalConfig.mcpServers)[0]
  if (!serverName) return null

  const originalServerConfig = originalConfig.mcpServers[serverName]
  if (!originalServerConfig) return null

  // Build args array from current argumentItems order
  const currentArgs = argumentItems.value.map(item => item.name)

  // Reconstruct the config with current argument order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reconstructedConfig: any = {
    mcpServers: {
      [serverName]: {}
    }
  }

  // Copy command if exists
  if (originalServerConfig.command) {
    reconstructedConfig.mcpServers[serverName].command = originalServerConfig.command
  }

  // Use current args order
  if (currentArgs.length > 0) {
    reconstructedConfig.mcpServers[serverName].args = currentArgs
  }

  // Copy env if exists
  if (originalServerConfig.env && Object.keys(originalServerConfig.env).length > 0) {
    reconstructedConfig.mcpServers[serverName].env = originalServerConfig.env
  }

  // Copy url/type/headers for HTTP servers
  if (originalServerConfig.url) {
    reconstructedConfig.mcpServers[serverName].url = originalServerConfig.url
  }
  if (originalServerConfig.type) {
    reconstructedConfig.mcpServers[serverName].type = originalServerConfig.type
  }
  if (originalServerConfig.headers && Object.keys(originalServerConfig.headers).length > 0) {
    reconstructedConfig.mcpServers[serverName].headers = originalServerConfig.headers
  }

  try {
    return JSON.stringify(reconstructedConfig, null, 2)
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
  if (type === 'arg') {
    formDataLocal.value.category = 'template'
  } else if (type === 'env') {
    formDataLocal.value.category = 'team'
  } else if (type === 'header') {
    formDataLocal.value.category = 'team'
  } else if (type === 'query_param') {
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
    visible_to_users: true
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
  } else if (formDataLocal.value.type === 'query_param') {
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

  // Trigger reactivity and emit
  localData.value = [...localData.value]
  nextTick(() => {
    emitModelValue()
  })
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

  // Trigger reactivity and emit
  localData.value = [...localData.value]
  nextTick(() => {
    emitModelValue()
  })
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

const handleQueryParamAdd = () => openAddModal('query_param')
const handleQueryParamEdit = (index: number) => {
  const queryParamItem = queryParamItems.value[index]
  if (!queryParamItem) return
  const globalIndex = localData.value.findIndex(item => item.id === queryParamItem.id)
  openEditModal(globalIndex)
}
const handleQueryParamDelete = (index: number) => {
  const queryParamItem = queryParamItems.value[index]
  if (!queryParamItem) return
  const globalIndex = localData.value.findIndex(item => item.id === queryParamItem.id)
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
    <!-- Arguments Section - Only show for STDIO servers -->
    <DsCard v-if="!isHttpBasedServer" :title="$t('mcpCatalog.form.configurationSchema.arguments.title')">
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
    <DsCard v-if="!isHttpBasedServer" :title="$t('mcpCatalog.form.configurationSchema.environment.title')">
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

    <!-- Headers Configuration Section - Always show for HTTP servers -->
    <DsCard v-if="isHttpBasedServer" :title="$t('mcpCatalog.form.configurationSchema.headers.title')">
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

    <!-- URL Query Parameters Configuration Section - Always show for HTTP servers -->
    <DsCard v-if="isHttpBasedServer" :title="$t('mcpCatalog.form.configurationSchema.urlQueryParams.title')">
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
