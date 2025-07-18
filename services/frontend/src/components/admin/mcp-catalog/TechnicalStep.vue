<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Copy } from 'lucide-vue-next'
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
const extractedEnvVars = ref<string[]>([])

// Storage key for persistence
const STORAGE_KEY = 'edit_claude_config'

// Initialize from storage or convert from existing data
onMounted(() => {
  // Try to get from storage first
  const storedConfig = eventBus.getState<string>(STORAGE_KEY)

  if (storedConfig) {
    jsonInput.value = storedConfig
  } else {
    // Convert existing installation_methods to Claude Desktop format
    convertExistingDataToJson()
  }
})

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

// Example configurations
const examples = computed(() => [
  {
    title: t('mcpCatalog.form.technical.claudeConfig.examples.brightData.title'),
    description: t('mcpCatalog.form.technical.claudeConfig.examples.brightData.description'),
    config: `{
  "mcpServers": {
    "bright-data": {
      "command": "npx",
      "args": ["@brightdata/mcp"],
      "env": {
        "API_TOKEN": "<your-bright-data-api-token>"
      }
    }
  }
}`
  },
  {
    title: t('mcpCatalog.form.technical.claudeConfig.examples.filesystem.title'),
    description: t('mcpCatalog.form.technical.claudeConfig.examples.filesystem.description'),
    config: `{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path/to/directory"],
      "env": {}
    }
  }
}`
  }
])

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
  // Store in event bus storage
  eventBus.setState(STORAGE_KEY, newValue)

  const validation = validateJson(newValue)

  if (validation.isValid) {
    validationError.value = null
    isValid.value = true
    extractedServerName.value = validation.serverName || ''
    extractedCommand.value = validation.command || ''
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

    // Update the form data
    emit('update:modelValue', {
      ...props.modelValue,
      installation_methods: installationMethods
    })
  } else {
    validationError.value = validation.error || t('mcpCatalog.form.technical.claudeConfig.validation.invalidJson')
    isValid.value = false
    extractedServerName.value = ''
    extractedCommand.value = ''
    extractedEnvVars.value = []
  }
}, { immediate: true })

// Helper functions
const copyExample = (config: string) => {
  jsonInput.value = config
  navigator.clipboard.writeText(config)
}

const formatJson = () => {
  try {
    const parsed = JSON.parse(jsonInput.value)
    jsonInput.value = JSON.stringify(parsed, null, 2)
  } catch {
    // Ignore formatting errors
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
  eventBus.clearState(STORAGE_KEY)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h3 class="text-lg font-medium">{{ t('mcpCatalog.form.technical.title') }}</h3>
      <p class="text-sm text-muted-foreground mt-1">
        {{ t('mcpCatalog.form.technical.subtitle') }}
      </p>
    </div>

    <!-- Configuration Input -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <Label for="claude-config">{{ t('mcpCatalog.form.technical.claudeConfig.label') }}</Label>
        <div class="flex items-center gap-2">
          <component :is="statusIcon" :class="['h-4 w-4', statusColor]" />
          <span :class="['text-sm', statusColor]">
            {{ isValid ? t('mcpCatalog.form.technical.claudeConfig.validConfiguration') : t('mcpCatalog.form.technical.claudeConfig.invalidConfiguration') }}
          </span>
        </div>
      </div>

      <Textarea
        id="claude-config"
        v-model="jsonInput"
        :placeholder="t('mcpCatalog.form.technical.claudeConfig.placeholder')"
        class="min-h-[200px] font-mono text-sm"
        :class="{ 'border-destructive': validationError }"
      />

      <div class="flex justify-end">
        <button
          type="button"
          @click="formatJson"
          class="text-xs text-muted-foreground hover:text-foreground"
        >
          {{ t('mcpCatalog.form.technical.claudeConfig.formatButton') }}
        </button>
      </div>
    </div>

    <!-- Validation Error -->
    <Alert v-if="validationError" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <AlertDescription>
        {{ validationError }}
      </AlertDescription>
    </Alert>

    <!-- Configuration Preview -->
    <Card v-if="isValid" class="border-green-200 bg-green-50">
      <CardHeader>
        <CardTitle class="text-sm text-green-800">{{ t('mcpCatalog.form.technical.claudeConfig.preview.title') }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <div>
          <Label class="text-xs text-green-700">{{ t('mcpCatalog.form.technical.claudeConfig.preview.serverName') }}</Label>
          <Badge variant="outline" class="ml-2">{{ extractedServerName }}</Badge>
        </div>
        <div>
          <Label class="text-xs text-green-700">{{ t('mcpCatalog.form.technical.claudeConfig.preview.command') }}</Label>
          <code class="ml-2 text-sm bg-green-100 px-2 py-1 rounded">{{ extractedCommand }}</code>
        </div>
        <div v-if="extractedEnvVars.length > 0">
          <Label class="text-xs text-green-700">{{ t('mcpCatalog.form.technical.claudeConfig.preview.environmentVariables') }}</Label>
          <div class="flex flex-wrap gap-1 mt-1">
            <Badge v-for="envVar in extractedEnvVars" :key="envVar" variant="secondary" class="text-xs">
              {{ envVar }}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Examples -->
    <div class="space-y-4">
      <h4 class="text-sm font-medium">{{ t('mcpCatalog.form.technical.claudeConfig.examples.title') }}</h4>
      <div class="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        <Card v-for="example in examples" :key="example.title" class="cursor-pointer hover:bg-muted/50">
          <CardHeader class="pb-2">
            <div class="flex items-center justify-between">
              <CardTitle class="text-sm">{{ example.title }}</CardTitle>
              <button
                @click="copyExample(example.config)"
                class="p-1 hover:bg-background rounded"
                :title="t('mcpCatalog.form.technical.claudeConfig.examples.copyExample')"
              >
                <Copy class="h-3 w-3" />
              </button>
            </div>
            <CardDescription class="text-xs">{{ example.description }}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre class="text-xs bg-muted p-2 rounded overflow-x-auto">{{ example.config }}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
