<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { Badge } from '@/components/ui/badge'

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { AlertCircle, CheckCircle } from 'lucide-vue-next'
import type {
  TechnicalFormData
} from '@/views/admin/mcp-server-catalog/types'

interface Props {
  modelValue: TechnicalFormData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any
}

interface Emits {
  (e: 'update:modelValue', value: TechnicalFormData): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (e: 'update:formData', value: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()
const eventBus = useEventBus()

// Local state for Claude Desktop config
const jsonInput = ref('')
const validationError = ref<string | null>(null)
const isValid = ref(false)
const extractedServerName = ref<string>('')
const extractedCommand = ref<string>('')
const extractedArgs = ref<string[]>([])
const extractedEnvVars = ref<string[]>([])
const isUpdatingFromStorage = ref(false)

// Storage key for persistence
const STORAGE_KEY = 'edit_claude_config'

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
  // Always load the latest config from storage first
  loadLatestConfigFromStorage()

  // Listen for step changes to trigger sync
  eventBus.on('mcp-form-step-changed', handleStepChanged)

  // Listen for storage changes to immediately sync
  eventBus.on('storage-changed', handleStorageChanged)
})

// Handle storage changes for immediate sync
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleStorageChanged = (data: { key: string; oldValue: any; newValue: any }) => {
  if (data.key === STORAGE_KEY && data.newValue && data.newValue !== jsonInput.value) {
    isUpdatingFromStorage.value = true
    jsonInput.value = data.newValue
    isUpdatingFromStorage.value = false
  }
}

// Load the latest configuration from storage
const loadLatestConfigFromStorage = () => {
  const storedConfig = eventBus.getState<string>(STORAGE_KEY)

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
  if (props.modelValue.installation_methods && props.modelValue.installation_methods.length > 0) {
    // Find the first valid installation method (skip git clone templates)
    const validMethod = props.modelValue.installation_methods.find(method =>
      method.command &&
      method.command !== 'git clone <repository_url>' &&
      !method.command.includes('<repository_url>')
    )

    if (validMethod) {
      const serverName = extractServerNameFromMethod(validMethod) || 'mcp-server'

      const claudeConfig = {
        mcpServers: {
          [serverName]: {
            command: validMethod.command || 'npx',
            args: validMethod.args || [],
            env: validMethod.env || {}
          }
        }
      }

      jsonInput.value = JSON.stringify(claudeConfig, null, 2)
    }
  }
}

// Helper function to extract server name from installation method
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractServerNameFromMethod = (method: any): string => {
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



// Validation function (copied from ClaudeDesktopConfigStep)
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
    const serverConfig = parsed.mcpServers[serverKey]

    // Validate server configuration structure
    if (!serverConfig.command || typeof serverConfig.command !== 'string') {
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
      command: serverConfig.command,
      args: serverConfig.args,
      envVars: serverConfig.env ? Object.keys(serverConfig.env) : []
    }
  } catch {
    return { isValid: false, error: t('mcpCatalog.form.technical.claudeConfig.validation.invalidJson') }
  }
}

// Watch for input changes and validate
watch(jsonInput, (newValue) => {
  // Don't save to storage if we're updating from storage (prevent recursion)
  if (!isUpdatingFromStorage.value) {
    eventBus.setState(STORAGE_KEY, newValue)
  }

  const validation = validateJson(newValue)

  if (validation.isValid) {
    validationError.value = null
    isValid.value = true
    extractedServerName.value = validation.serverName || ''
    extractedCommand.value = validation.command || ''
    extractedArgs.value = validation.args || []
    extractedEnvVars.value = validation.envVars || []

    // Convert back to installation_methods format for form compatibility
    const serverName = validation.serverName!
    const serverConfig = validation.parsed.mcpServers[serverName]

    const installationMethods = [{
      client: 'claude-desktop' as const,
      command: serverConfig.command,
      args: serverConfig.args,
      env: serverConfig.env || {}
    }]

    // Update the technical form data
    emit('update:modelValue', {
      ...props.modelValue,
      installation_methods: installationMethods
    })

    // Also update the capabilities section with environment variables
    if (validation.envVars && validation.envVars.length > 0) {
      const envVariables = validation.envVars.map(envVar => ({
        name: envVar,
        description: t('mcpCatalog.form.technical.claudeConfig.autoDescription'),
        required: true,
        type: 'password' // Default to password type for security
      }))

      const updatedFormData = {
        ...props.formData,
        capabilities: {
          ...props.formData.capabilities,
          environment_variables: envVariables
        }
      }

      emit('update:formData', updatedFormData)
    }
  } else {
    validationError.value = validation.error || t('mcpCatalog.form.technical.claudeConfig.validation.invalidJson')
    isValid.value = false
    extractedServerName.value = ''
    extractedCommand.value = ''
    extractedArgs.value = []
    extractedEnvVars.value = []
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
  // eventBus.clearState(STORAGE_KEY)
  eventBus.off('mcp-form-step-changed', handleStepChanged)
  eventBus.off('storage-changed', handleStorageChanged)
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
