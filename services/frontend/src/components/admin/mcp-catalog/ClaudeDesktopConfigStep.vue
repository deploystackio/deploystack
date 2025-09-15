<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle } from 'lucide-vue-next'

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
const extractedUrl = ref<string>('')
const extractedType = ref<string>('')
const extractedHeaders = ref<string[]>([])
const extractedEnvVars = ref<string[]>([])
const isUrlBasedServer = ref<boolean>(false)

// Static example configuration
const staticExample = `{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ]
    }
  }
}`

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
    if (!serverKey) {
      return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.noServers') }
    }
    const serverConfig = parsed.mcpServers[serverKey]

    // Validate server configuration structure
    // Support both command-based and URL-based servers
    const isUrlBasedServer = serverConfig.url && serverConfig.type
    const isCommandBasedServer = serverConfig.command && serverConfig.args
    
    if (!isUrlBasedServer && !isCommandBasedServer) {
      return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.invalidServerType') }
    }
    
    // Validate command-based servers
    if (isCommandBasedServer) {
      if (typeof serverConfig.command !== 'string') {
        return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.missingCommand') }
      }
      if (!Array.isArray(serverConfig.args)) {
        return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.missingArgs') }
      }
    }
    
    // Validate URL-based servers
    if (isUrlBasedServer) {
      if (typeof serverConfig.url !== 'string') {
        return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.invalidUrl') }
      }
      if (typeof serverConfig.type !== 'string') {
        return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.invalidType') }
      }
      // headers are optional for URL-based servers
      if (serverConfig.headers && typeof serverConfig.headers !== 'object') {
        return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.invalidHeaders') }
      }
    }

    // env is optional but if present must be an object
    if (serverConfig.env && typeof serverConfig.env !== 'object') {
      return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.invalidEnv') }
    }

    return {
      isValid: true,
      parsed,
      serverName: serverKey,
      command: serverConfig.command || null,
      args: serverConfig.args || null,
      url: serverConfig.url || null,
      type: serverConfig.type || null,
      headers: serverConfig.headers ? Object.keys(serverConfig.headers) : [],
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
    extractedUrl.value = validation.url || ''
    extractedType.value = validation.type || ''
    extractedHeaders.value = validation.headers || []
    extractedEnvVars.value = validation.envVars || []
    isUrlBasedServer.value = !!(validation.url && validation.type)

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
    extractedUrl.value = ''
    extractedType.value = ''
    extractedHeaders.value = []
    extractedEnvVars.value = []
    isUrlBasedServer.value = false

    // Still emit the raw JSON for editing purposes
    emit('update:modelValue', {
      claude_desktop_config: {},
      raw_json: newValue
    })
  }
}, { immediate: true })

// Helper functions
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
        <div v-if="!isUrlBasedServer">
          <Label class="text-xs text-green-700">{{ t('mcpCatalog.form.claudeConfig.preview.command') }}</Label>
          <code class="ml-2 text-sm bg-green-100 px-2 py-1 rounded">{{ extractedCommand }}</code>
        </div>
        <div v-if="isUrlBasedServer">
          <Label class="text-xs text-green-700">{{ t('mcpCatalog.form.claudeConfig.preview.url') }}</Label>
          <code class="ml-2 text-sm bg-green-100 px-2 py-1 rounded">{{ extractedUrl }}</code>
        </div>
        <div v-if="isUrlBasedServer">
          <Label class="text-xs text-green-700">{{ t('mcpCatalog.form.claudeConfig.preview.type') }}</Label>
          <Badge variant="outline" class="ml-2">{{ extractedType }}</Badge>
        </div>
        <div v-if="isUrlBasedServer && extractedHeaders.length > 0">
          <Label class="text-xs text-green-700">{{ t('mcpCatalog.form.claudeConfig.preview.headers') }}</Label>
          <div class="flex flex-wrap gap-1 mt-1">
            <Badge v-for="header in extractedHeaders" :key="header" variant="secondary" class="text-xs">
              {{ header }}
            </Badge>
          </div>
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

    <!-- Example -->
    <div class="space-y-4">
      <h4 class="text-sm font-medium">{{ t('mcpCatalog.form.claudeConfig.examples.title') }}</h4>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm">Configuration Example</CardTitle>
          <CardDescription class="text-xs">Basic MCP server configuration structure</CardDescription>
        </CardHeader>
        <CardContent>
          <pre class="text-xs bg-muted p-2 rounded overflow-x-auto">{{ staticExample }}</pre>
        </CardContent>
      </Card>
    </div>

  </div>
</template>
