<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { AlertCircle, CheckCircle } from 'lucide-vue-next'
import type {
  TechnicalFormData
} from '@/views/admin/mcp-server-catalog/types'

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

// Storage keys
const STORAGE_KEY = 'edit_technical_data'
const CLAUDE_CONFIG_KEY = 'edit_claude_config'

// Check if we're in edit mode
const isEditMode = computed(() => props.mode === 'edit')

// Local reactive data - storage-first approach
const localData = ref<TechnicalFormData>({
  language: '',
  runtime: '',
  installation_methods: [],
  dependencies: '',
  transport_type: isEditMode.value ? 'stdio' : 'auto'
})

// Local state for Claude Desktop config
const jsonInput = ref('')
const validationError = ref<string | null>(null)
const isValid = ref(false)
const extractedServerName = ref<string>('')

// For stdio servers
const extractedCommand = ref<string>('')
const extractedArgs = ref<string[]>([])
const extractedEnvVars = ref<string[]>([])

// For HTTP servers
const extractedUrl = ref<string>('')
const extractedType = ref<string>('')
const extractedHeaders = ref<Record<string, string>>({})
const extractedHeaderKeys = ref<string[]>([])
const isHttpServer = ref(false)

const isUpdatingFromStorage = ref(false)

// Load data from storage
const loadFromStorage = () => {
  const storedData = eventBus.getState<TechnicalFormData>(STORAGE_KEY)

  if (storedData) {
    localData.value = { ...localData.value, ...storedData }
  } else if (props.formData?.technical) {
    // If no stored data but we have initial form data (edit mode), use it

    // Parse installation_methods if it's a string (from database)
    let installationMethods = props.formData.technical.installation_methods
    if (typeof installationMethods === 'string') {
      try {
        installationMethods = JSON.parse(installationMethods)
      } catch {
        installationMethods = []
      }
    }

    localData.value = {
      ...localData.value,
      ...props.formData.technical,
      installation_methods: installationMethods
    }
    // Save it to storage for consistency
    saveToStorage()
  }
}

// Flag to prevent recursive updates
let isUpdatingFromStorageFlag = false

// Save data to storage
const saveToStorage = () => {
  if (!isUpdatingFromStorageFlag) {
    eventBus.setState(STORAGE_KEY, localData.value)
  }
}

// Update field and save to storage
const updateField = <K extends keyof TechnicalFormData>(field: K, value: TechnicalFormData[K]) => {
  localData.value[field] = value
  saveToStorage()
}

// Listen for storage changes from other components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleStorageChange = (data: { key: string; newValue: any }) => {
  if (data.key === STORAGE_KEY && data.newValue) {
    isUpdatingFromStorageFlag = true
    localData.value = { ...localData.value, ...data.newValue }
    // Reset flag after Vue's next tick to allow the watcher to run
    setTimeout(() => {
      isUpdatingFromStorageFlag = false
    }, 0)
  }
}

// Watch for changes in localData and save to storage
watch(localData, saveToStorage, { deep: true })

// Watch for changes in props.formData to handle initial data loading in edit mode
watch(
  () => props.formData?.technical,
  (newTechnicalData) => {
    if (newTechnicalData && isEditMode.value) {
      // Only update if storage doesn't already have data or if the language is missing
      const storedData = eventBus.getState<TechnicalFormData>(STORAGE_KEY)
      if (!storedData || !storedData.language) {
        localData.value = { ...localData.value, ...newTechnicalData }
        saveToStorage()
      }
    }
  },
  { immediate: true, deep: true }
)

// Example configuration for hover card
const exampleConfig = `{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-memory"
      ],
      "env": {
        "MEMORY_FILE_PATH": "/path/to-your/memory/claude-memory.json"
      }
    }
  }
}`

// Initialize from storage or convert from existing data
onMounted(() => {
  // Load technical data from storage
  loadFromStorage()

  // Always load the latest config from storage first
  loadLatestConfigFromStorage()

  // Listen for step changes to trigger sync
  eventBus.on('mcp-form-step-changed', handleStepChanged)

  // Listen for storage changes to immediately sync
  eventBus.on('storage-changed', handleStorageChanged)
  eventBus.on('storage-changed', handleStorageChange)
})

// Handle storage changes for immediate sync
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleStorageChanged = (data: { key: string; oldValue: any; newValue: any }) => {
  if (data.key === CLAUDE_CONFIG_KEY && data.newValue && data.newValue !== jsonInput.value) {
    isUpdatingFromStorage.value = true
    jsonInput.value = data.newValue
    isUpdatingFromStorage.value = false
  }
}

// Load the latest configuration from storage
const loadLatestConfigFromStorage = () => {
  const storedConfig = eventBus.getState<string>(CLAUDE_CONFIG_KEY)

  if (storedConfig && storedConfig.trim()) {
    isUpdatingFromStorage.value = true
    jsonInput.value = storedConfig
    isUpdatingFromStorage.value = false
  } else {
    convertExistingDataToJson()
  }
}

// Convert existing installation_methods to Claude Desktop JSON format
const convertExistingDataToJson = () => {
  if (localData.value.installation_methods && localData.value.installation_methods.length > 0) {
    // Find the first valid installation method
    const validMethod = localData.value.installation_methods.find(method =>
      (method.command && method.command !== 'git clone <repository_url>' && !method.command.includes('<repository_url>')) ||
      method.url // Also accept HTTP methods
    )

    if (validMethod) {
      const serverName = extractServerNameFromMethod(validMethod) || 'mcp-server'

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let serverConfig: any

      if (validMethod.url) {
        // HTTP server configuration
        serverConfig = {
          url: validMethod.url,
          type: validMethod.type || 'streamableHttp',
          headers: validMethod.headers || {}
        }
      } else {
        // Command-based server configuration
        serverConfig = {
          command: validMethod.command || 'npx',
          args: validMethod.args || [],
          env: validMethod.env || {}
        }
      }

      const claudeConfig = {
        mcpServers: {
          [serverName]: serverConfig
        }
      }

      jsonInput.value = JSON.stringify(claudeConfig, null, 2)
    }
  } else {
    // Maybe the data isn't loaded yet, try to get it from props
    if (props.formData?.technical?.installation_methods) {
      let installationMethods = props.formData.technical.installation_methods

      // Parse if it's a string
      if (typeof installationMethods === 'string') {
        try {
          installationMethods = JSON.parse(installationMethods)
        } catch {
          return
        }
      }

      if (installationMethods && installationMethods.length > 0) {
        localData.value.installation_methods = installationMethods
        // Retry conversion after updating localData
        setTimeout(() => convertExistingDataToJson(), 50)
      }
    }
  }
}

// Helper function to extract server name from installation method
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractServerNameFromMethod = (method: any): string => {
  // Handle URL-based methods (HTTP servers)
  if (method.url) {
    try {
      const url = new URL(method.url)
      const hostname = url.hostname
      // Extract meaningful name from hostname
      if (hostname.includes('context7')) return 'context7'
      if (hostname.includes('mcp.')) {
        const name = hostname.replace('mcp.', '').split('.')[0]
        return name || 'mcp-server'
      }
      const name = hostname.split('.')[0]
      return name || 'mcp-server'
    } catch {
      return 'mcp-server'
    }
  }

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

  // Try to extract from form name
  if (props.formData?.basic?.name) {
    return props.formData.basic.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace('-mcp', '')
      .replace('mcp-', '')
  }

  return 'mcp-server'
}



// Validation function for both HTTP and stdio servers
const validateJson = (jsonString: string) => {
  try {
    if (!jsonString.trim()) {
      return { isValid: false, error: t('mcpCatalog.form.technical.claudeConfig.validation.required') }
    }

    const parsed = JSON.parse(jsonString)

    // Check if it has mcpServers property
    if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
      return { isValid: false, error: t('mcpCatalog.form.technical.claudeConfig.validation.missingMcpServers') }
    }

    // Check if exactly one server is defined
    const serverKeys = Object.keys(parsed.mcpServers)
    if (serverKeys.length === 0) {
      return { isValid: false, error: t('mcpCatalog.form.technical.claudeConfig.validation.noServers') }
    }
    if (serverKeys.length > 1) {
      return { isValid: false, error: t('mcpCatalog.form.technical.claudeConfig.validation.multipleServers') }
    }

    const serverKey = serverKeys[0]
    if (!serverKey) {
      return { isValid: false, error: t('mcpCatalog.form.technical.claudeConfig.validation.noServers') }
    }
    const serverConfig = parsed.mcpServers[serverKey]

    // Validate server configuration structure - check for HTTP or stdio
    if (serverConfig.url) {
      // HTTP server validation
      if (typeof serverConfig.url !== 'string' || !serverConfig.url.startsWith('http')) {
        return { isValid: false, error: 'Invalid URL - must be a valid HTTP/HTTPS URL' }
      }

      // type is optional for HTTP servers
      if (serverConfig.type && typeof serverConfig.type !== 'string') {
        return { isValid: false, error: 'Invalid type - must be a string' }
      }

      // headers is optional but if present must be an object
      if (serverConfig.headers && typeof serverConfig.headers !== 'object') {
        return { isValid: false, error: 'Invalid headers - must be an object' }
      }

      return {
        isValid: true,
        parsed,
        serverName: serverKey,
        isHttpServer: true,
        url: serverConfig.url,
        type: serverConfig.type || 'streamableHttp',
        headers: serverConfig.headers || {},
        headerKeys: serverConfig.headers ? Object.keys(serverConfig.headers) : []
      }
    } else if (serverConfig.command) {
      // Stdio server validation
      if (typeof serverConfig.command !== 'string') {
        return { isValid: false, error: t('mcpCatalog.form.technical.claudeConfig.validation.missingCommand') }
      }

      if (!serverConfig.args || !Array.isArray(serverConfig.args)) {
        return { isValid: false, error: t('mcpCatalog.form.technical.claudeConfig.validation.missingArgs') }
      }

      // env is optional but if present must be an object
      if (serverConfig.env && typeof serverConfig.env !== 'object') {
        return { isValid: false, error: t('mcpCatalog.form.technical.claudeConfig.validation.invalidEnv') }
      }

      return {
        isValid: true,
        parsed,
        serverName: serverKey,
        isHttpServer: false,
        command: serverConfig.command,
        args: serverConfig.args,
        envVars: serverConfig.env ? Object.keys(serverConfig.env) : []
      }
    } else {
      return { isValid: false, error: 'Server configuration must have either "url" (for HTTP servers) or "command" (for stdio servers)' }
    }
  } catch {
    return { isValid: false, error: t('mcpCatalog.form.technical.claudeConfig.validation.invalidJson') }
  }
}

// Watch for input changes and validate
watch(jsonInput, (newValue) => {
  // Don't save to storage if we're updating from storage (prevent recursion)
  if (!isUpdatingFromStorage.value) {
    eventBus.setState(CLAUDE_CONFIG_KEY, newValue)
  }

  const validation = validateJson(newValue)

  if (validation.isValid) {
    validationError.value = null
    isValid.value = true
    extractedServerName.value = validation.serverName || ''
    isHttpServer.value = validation.isHttpServer || false

    if (validation.isHttpServer) {
      // HTTP server
      extractedUrl.value = validation.url || ''
      extractedType.value = validation.type || ''
      extractedHeaders.value = validation.headers || {}
      extractedHeaderKeys.value = validation.headerKeys || []

      // Clear stdio fields
      extractedCommand.value = ''
      extractedArgs.value = []
      extractedEnvVars.value = []

      // Emit event for headers if any
      if (validation.headerKeys && validation.headerKeys.length > 0) {
        eventBus.emit('technical-headers-updated', {
          headers: validation.headerKeys
        })
        eventBus.setState('technical_extracted_headers_edit', validation.headerKeys)
      }

      // Convert to remotes format for HTTP
      updateField('packages', null)
      updateField('remotes', [{
        type: validation.type || 'sse',
        url: validation.url,
        headers: validation.headers || {}
      }])
    } else {
      // Stdio server
      extractedCommand.value = validation.command || ''
      extractedArgs.value = validation.args || []
      extractedEnvVars.value = validation.envVars || []

      // Clear HTTP fields
      extractedUrl.value = ''
      extractedType.value = ''
      extractedHeaders.value = {}
      extractedHeaderKeys.value = []

      // Emit event for ConfigurationSchemaStep to sync environment variables
      eventBus.emit('technical-env-vars-updated', {
        envVars: validation.envVars || []
      })

      // ALSO store in persistent storage for ConfigurationSchemaStep to load later
      eventBus.setState('technical_extracted_env_vars_edit', validation.envVars || [])

      // Convert to packages format for stdio
      const serverName = validation.serverName!
      const serverConfig = validation.parsed.mcpServers[serverName]

      updateField('remotes', null)
      updateField('packages', [{
        transport: {
          type: 'stdio',
          command: serverConfig.command,
          args: serverConfig.args
        },
        env: serverConfig.env || {}
      }])

      // Also update the capabilities section with environment variables
      if (validation.envVars && validation.envVars.length > 0) {
        // Get existing environment variables from database/capabilities storage
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingCapabilitiesData = eventBus.getState<any>('edit_capabilities_data')
        const existingEnvVars = existingCapabilitiesData?.environment_variables || []

        // Smart merge: preserve existing env var properties, add new ones with defaults
        const envVariables = validation.envVars.map(envVar => {
          // Check if this env var already exists in database
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existing = existingEnvVars.find((existing: any) => existing.name === envVar)

          if (existing) {
            // Keep existing properties (required, type, description, etc.), just ensure name is correct
            return { ...existing, name: envVar }
          } else {
            // New env var - use defaults
            return {
              name: envVar,
              description: t('mcpCatalog.form.technical.claudeConfig.autoDescription'),
              required: true,
              type: 'password' // Default to password type for security
            }
          }
        })

        // Save environment variables to capabilities storage
        eventBus.setState('capabilities_env_vars', envVariables)
      }
    }
  } else {
    validationError.value = validation.error || t('mcpCatalog.form.technical.claudeConfig.validation.invalidJson')
    isValid.value = false
    extractedServerName.value = ''
    isHttpServer.value = false

    // Clear all extracted fields
    extractedCommand.value = ''
    extractedArgs.value = []
    extractedEnvVars.value = []
    extractedUrl.value = ''
    extractedType.value = ''
    extractedHeaders.value = {}
    extractedHeaderKeys.value = []
  }
}, { immediate: true })

// Helper functions
const showExample = () => {
  // Only copy to clipboard, don't overwrite the textarea
  navigator.clipboard.writeText(exampleConfig)
}

const formatJson = () => {
  try {
    const parsed = JSON.parse(jsonInput.value)
    jsonInput.value = JSON.stringify(parsed, null, 2)
  } catch {
    // Ignore formatting errors
  }
}

// Handle step changes to trigger sync when navigating to TechnicalStep
const handleStepChanged = (data: { from: number; to: number; stepKey: string }) => {
  // If we're navigating TO the technical step, reload latest config
  if (data.stepKey === 'technical') {
    // Small delay to ensure component is ready
    setTimeout(() => {
      loadLatestConfigFromStorage()
    }, 50)
  }

}

// Computed properties
const statusIcon = computed(() => {
  return isValid.value ? CheckCircle : AlertCircle
})

const statusColor = computed(() => {
  return isValid.value ? 'text-green-600' : 'text-red-600'
})

// Clean up storage on unmount
onUnmounted(() => {
  // DON'T clear the storage - we need it for CapabilitiesStep to update
  // eventBus.clearState(CLAUDE_CONFIG_KEY)
  eventBus.off('mcp-form-step-changed', handleStepChanged)
  eventBus.off('storage-changed', handleStorageChanged)
  eventBus.off('storage-changed', handleStorageChange)
})
</script>

<template>
  <!-- Header Section -->
  <div class="px-4 sm:px-0">
    <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpCatalog.form.technical.title') }}</h3>
    <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">
      {{ t('mcpCatalog.form.technical.subtitle') }}
    </p>
  </div>

  <!-- Structured Form Fields -->
  <div class="mt-6 border-t border-gray-100">
    <dl class="divide-y divide-gray-100">
      <!-- Language Selection -->
      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.technical.language.label') }}</dt>
        <dd class="mt-1 sm:col-span-2 sm:mt-0">
          <Select
            :model-value="localData.language"
            @update:model-value="(value: any) => updateField('language', String(value || ''))"
          >
            <SelectTrigger>
              <SelectValue :placeholder="t('mcpCatalog.form.technical.language.placeholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="JavaScript">
                {{ t('mcpCatalog.form.technical.language.options.javascript') }}
              </SelectItem>
              <SelectItem value="TypeScript">
                {{ t('mcpCatalog.form.technical.language.options.typescript') }}
              </SelectItem>
              <SelectItem value="Python">
                {{ t('mcpCatalog.form.technical.language.options.python') }}
              </SelectItem>
              <SelectItem value="Go">
                {{ t('mcpCatalog.form.technical.language.options.go') }}
              </SelectItem>
              <SelectItem value="C#">
                {{ t('mcpCatalog.form.technical.language.options.csharp') }}
              </SelectItem>
              <SelectItem value="C++">
                {{ t('mcpCatalog.form.technical.language.options.cpp') }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground mt-1">
            {{ t('mcpCatalog.form.technical.language.description') }}
          </p>
        </dd>
      </div>

      <!-- Transport Type -->
      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.technical.transportType.label') }}</dt>
        <dd class="mt-1 sm:col-span-2 sm:mt-0">
          <Select
            :model-value="localData.transport_type"
            @update:model-value="(value: any) => updateField('transport_type', String(value || 'auto'))"
          >
            <SelectTrigger>
              <SelectValue :placeholder="t('mcpCatalog.form.technical.transportType.placeholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-if="!isEditMode" value="auto">
                {{ t('mcpCatalog.form.technical.transportType.options.auto') }}
              </SelectItem>
              <SelectItem value="stdio">
                {{ t('mcpCatalog.form.technical.transportType.options.stdio') }}
              </SelectItem>
              <SelectItem value="http">
                {{ t('mcpCatalog.form.technical.transportType.options.http') }}
              </SelectItem>
              <SelectItem value="sse">
                {{ t('mcpCatalog.form.technical.transportType.options.sse') }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground mt-1">
            {{ isEditMode ?
              t('mcpCatalog.form.technical.transportType.editDescription') :
              t('mcpCatalog.form.technical.transportType.description')
            }}
          </p>
        </dd>
      </div>

      <!-- Claude Desktop Configuration -->
      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">
          {{ t('mcpCatalog.form.technical.claudeConfig.label') }}
        </dt>
        <dd class="mt-1 sm:col-span-2 sm:mt-0">
          <div class="space-y-3">
            <!-- Configuration Input -->
            <Textarea
              id="claude-config"
              v-model="jsonInput"
              :placeholder="t('mcpCatalog.form.technical.claudeConfig.placeholder')"
              class="min-h-[300px] font-mono text-sm"
              :class="{ 'border-destructive': validationError }"
            />

            <!-- Action Buttons Row -->
            <div class="flex justify-between items-center">
              <!-- Show Example Button with Hover Card -->
              <HoverCard>
                <HoverCardTrigger as-child>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    @click="showExample"
                  >
                    {{ t('mcpCatalog.form.technical.claudeConfig.showExampleButton') }}
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent class="w-96">
                  <div class="space-y-2">
                    <h4 class="text-sm font-semibold">{{ t('mcpCatalog.form.technical.claudeConfig.examples.title') }}</h4>
                    <p class="text-xs text-muted-foreground">
                      {{ t('mcpCatalog.form.technical.claudeConfig.examples.description') }}
                    </p>
                    <pre class="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">{{ exampleConfig }}</pre>
                  </div>
                </HoverCardContent>
              </HoverCard>

              <!-- Format Button -->
              <button
                type="button"
                @click="formatJson"
                class="text-xs text-muted-foreground hover:text-foreground"
              >
                {{ t('mcpCatalog.form.technical.claudeConfig.formatButton') }}
              </button>
            </div>

            <!-- Validation Status -->
            <div class="flex items-center gap-2">
              <component :is="statusIcon" :class="['h-4 w-4', statusColor]" />
              <span :class="['text-sm', statusColor]">
                {{ isValid ? t('mcpCatalog.form.technical.claudeConfig.validConfiguration') : t('mcpCatalog.form.technical.claudeConfig.invalidConfiguration') }}
              </span>
            </div>

            <!-- Help Text -->
            <p class="text-xs text-muted-foreground">
              {{ t('mcpCatalog.form.technical.claudeConfig.helpText') }}
            </p>
          </div>
        </dd>
      </div>

      <!-- Configuration Preview (when valid) -->
      <div v-if="isValid" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.technical.claudeConfig.preview.title') }}</dt>
        <dd class="mt-1 sm:col-span-2 sm:mt-0">
          <div class="space-y-4">
            <!-- Server Name -->
            <div class="flex items-center space-x-2">
              <span class="text-xs text-muted-foreground font-medium">{{ t('mcpCatalog.form.technical.claudeConfig.preview.serverName') }}:</span>
              <Badge variant="outline">{{ extractedServerName }}</Badge>
            </div>

            <!-- HTTP Server Preview -->
            <template v-if="isHttpServer">
              <!-- URL -->
              <div class="flex items-center space-x-2">
                <span class="text-xs text-muted-foreground font-medium">URL:</span>
                <code class="text-sm bg-muted px-2 py-1 rounded font-mono break-all">{{ extractedUrl }}</code>
              </div>

              <!-- Type -->
              <div class="flex items-center space-x-2">
                <span class="text-xs text-muted-foreground font-medium">Type:</span>
                <Badge variant="secondary">{{ extractedType }}</Badge>
              </div>

              <!-- Headers -->
              <div v-if="extractedHeaderKeys.length > 0" class="space-y-2">
                <span class="text-xs text-muted-foreground font-medium">Headers:</span>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li v-for="headerKey in extractedHeaderKeys" :key="headerKey">
                    <Badge variant="secondary" class="text-xs">
                      {{ headerKey }}: {{ extractedHeaders[headerKey] || '[hidden]' }}
                    </Badge>
                  </li>
                </ul>
              </div>
            </template>

            <!-- Stdio Server Preview -->
            <template v-else>
              <!-- Command -->
              <div class="flex items-center space-x-2">
                <span class="text-xs text-muted-foreground font-medium">{{ t('mcpCatalog.form.technical.claudeConfig.preview.command') }}:</span>
                <code class="text-sm bg-muted px-2 py-1 rounded font-mono">{{ extractedCommand }}</code>
              </div>

              <!-- Arguments -->
              <div v-if="extractedArgs.length > 0" class="space-y-2">
                <span class="text-xs text-muted-foreground font-medium">{{ t('mcpCatalog.form.technical.claudeConfig.preview.arguments') }}:</span>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li v-for="arg in extractedArgs" :key="arg">
                    <Badge variant="outline" class="text-xs">
                      {{ arg }}
                    </Badge>
                  </li>
                </ul>
              </div>

              <!-- Environment Variables -->
              <div v-if="extractedEnvVars.length > 0" class="space-y-2">
                <span class="text-xs text-muted-foreground font-medium">{{ t('mcpCatalog.form.technical.claudeConfig.preview.environmentVariables') }}:</span>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li v-for="envVar in extractedEnvVars" :key="envVar">
                    <Badge variant="secondary" class="text-xs">
                      {{ envVar }}
                    </Badge>
                  </li>
                </ul>
              </div>
            </template>
          </div>

          <p class="text-xs text-muted-foreground mt-3">
            {{ t('mcpCatalog.form.technical.claudeConfig.preview.description') }}
          </p>
        </dd>
      </div>
    </dl>
  </div>

  <!-- Validation Error Alert -->
  <Alert v-if="validationError" variant="destructive" class="mt-6">
    <AlertCircle class="h-4 w-4" />
    <AlertDescription>
      {{ validationError }}
    </AlertDescription>
  </Alert>
</template>
