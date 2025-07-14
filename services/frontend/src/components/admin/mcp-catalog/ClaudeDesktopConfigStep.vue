<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Copy } from 'lucide-vue-next'

// Props and emits
interface Props {
  modelValue: {
    claude_desktop_config: object
    raw_json: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: { claude_desktop_config: object; raw_json: string }]
}>()

const { t } = useI18n()

// Local state
const jsonInput = ref(props.modelValue.raw_json || '')
const validationError = ref<string | null>(null)
const isValid = ref(false)
const extractedServerName = ref<string>('')
const extractedCommand = ref<string>('')
const extractedEnvVars = ref<string[]>([])

// Example configurations
const examples = computed(() => [
  {
    title: t('mcpCatalog.form.claudeConfig.examples.brightData.title'),
    description: t('mcpCatalog.form.claudeConfig.examples.brightData.description'),
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
    title: t('mcpCatalog.form.claudeConfig.examples.filesystem.title'),
    description: t('mcpCatalog.form.claudeConfig.examples.filesystem.description'),
    config: `{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path/to/directory"],
      "env": {}
    }
  }
}`
  },
  {
    title: t('mcpCatalog.form.claudeConfig.examples.postgres.title'),
    description: t('mcpCatalog.form.claudeConfig.examples.postgres.description'),
    config: `{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://username:password@localhost:5432/database"
      }
    }
  }
}`
  }
])

// Validation function
const validateJson = (jsonString: string) => {
  try {
    if (!jsonString.trim()) {
      return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.required') }
    }

    const parsed = JSON.parse(jsonString)

    // Check if it has mcpServers property
    if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
      return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.missingMcpServers') }
    }

    // Check if exactly one server is defined
    const serverKeys = Object.keys(parsed.mcpServers)
    if (serverKeys.length === 0) {
      return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.noServers') }
    }
    if (serverKeys.length > 1) {
      return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.multipleServers') }
    }

    const serverKey = serverKeys[0]
    const serverConfig = parsed.mcpServers[serverKey]

    // Validate server configuration structure
    if (!serverConfig.command || typeof serverConfig.command !== 'string') {
      return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.missingCommand') }
    }

    if (!serverConfig.args || !Array.isArray(serverConfig.args)) {
      return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.missingArgs') }
    }

    // env is optional but if present must be an object
    if (serverConfig.env && typeof serverConfig.env !== 'object') {
      return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.invalidEnv') }
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
    return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.invalidJson') }
  }
}

// Watch for input changes and validate
watch(jsonInput, (newValue) => {
  const validation = validateJson(newValue)

  if (validation.isValid) {
    validationError.value = null
    isValid.value = true
    extractedServerName.value = validation.serverName || ''
    extractedCommand.value = validation.command || ''
    extractedEnvVars.value = validation.envVars || []

    // Emit the valid configuration
    emit('update:modelValue', {
      claude_desktop_config: validation.parsed,
      raw_json: newValue
    })
  } else {
    validationError.value = validation.error || 'Invalid configuration'
    isValid.value = false
    extractedServerName.value = ''
    extractedCommand.value = ''
    extractedEnvVars.value = []

    // Still emit the raw JSON for editing purposes
    emit('update:modelValue', {
      claude_desktop_config: {},
      raw_json: newValue
    })
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
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h3 class="text-lg font-medium">{{ t('mcpCatalog.form.claudeConfig.title') }}</h3>
      <p class="text-sm text-muted-foreground mt-1">
        {{ t('mcpCatalog.form.claudeConfig.description') }}
      </p>
    </div>

    <!-- Configuration Input -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <Label for="claude-config">{{ t('mcpCatalog.form.claudeConfig.label') }}</Label>
        <div class="flex items-center gap-2">
          <component :is="statusIcon" :class="['h-4 w-4', statusColor]" />
          <span :class="['text-sm', statusColor]">
            {{ isValid ? t('mcpCatalog.form.claudeConfig.validConfiguration') : t('mcpCatalog.form.claudeConfig.invalidConfiguration') }}
          </span>
        </div>
      </div>

      <Textarea
        id="claude-config"
        v-model="jsonInput"
        :placeholder="t('mcpCatalog.form.claudeConfig.placeholder')"
        class="min-h-[200px] font-mono text-sm"
        :class="{ 'border-destructive': validationError }"
      />

      <div class="flex justify-end">
        <button
          type="button"
          @click="formatJson"
          class="text-xs text-muted-foreground hover:text-foreground"
        >
          {{ t('mcpCatalog.form.claudeConfig.formatButton') }}
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
        <CardTitle class="text-sm text-green-800">{{ t('mcpCatalog.form.claudeConfig.preview.title') }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <div>
          <Label class="text-xs text-green-700">{{ t('mcpCatalog.form.claudeConfig.preview.serverName') }}</Label>
          <Badge variant="outline" class="ml-2">{{ extractedServerName }}</Badge>
        </div>
        <div>
          <Label class="text-xs text-green-700">{{ t('mcpCatalog.form.claudeConfig.preview.command') }}</Label>
          <code class="ml-2 text-sm bg-green-100 px-2 py-1 rounded">{{ extractedCommand }}</code>
        </div>
        <div v-if="extractedEnvVars.length > 0">
          <Label class="text-xs text-green-700">{{ t('mcpCatalog.form.claudeConfig.preview.environmentVariables') }}</Label>
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
      <h4 class="text-sm font-medium">{{ t('mcpCatalog.form.claudeConfig.examples.title') }}</h4>
      <div class="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        <Card v-for="example in examples" :key="example.title" class="cursor-pointer hover:bg-muted/50">
          <CardHeader class="pb-2">
            <div class="flex items-center justify-between">
              <CardTitle class="text-sm">{{ example.title }}</CardTitle>
              <button
                @click="copyExample(example.config)"
                class="p-1 hover:bg-background rounded"
                :title="t('mcpCatalog.form.claudeConfig.examples.copyExample')"
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
