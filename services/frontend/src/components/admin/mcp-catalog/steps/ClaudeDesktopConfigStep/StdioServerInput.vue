<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-vue-next'
import ClaudeConfigJsonInput from './ClaudeConfigJsonInput.vue'
import ClaudeConfigPreview from './ClaudeConfigPreview.vue'

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

// Validation function for stdio servers (command-based only)
const validateJson = (jsonString: string) => {
  try {
    if (!jsonString.trim()) {
      return { isValid: false, error: null }
    }

    const parsed = JSON.parse(jsonString)

    if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
      return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.missingMcpServers') }
    }

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

    // Validate stdio server configuration - command and args are required
    if (!serverConfig.command || typeof serverConfig.command !== 'string') {
      return { isValid: false, error: t('mcpCatalog.form.claudeConfig.validation.missingCommand') }
    }
    if (!Array.isArray(serverConfig.args)) {
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

    emit('update:modelValue', {
      claude_desktop_config: validation.parsed,
      raw_json: newValue
    })
  } else {
    validationError.value = validation.error ?? null
    isValid.value = false
    extractedServerName.value = ''
    extractedCommand.value = ''
    extractedEnvVars.value = []

    emit('update:modelValue', {
      claude_desktop_config: {},
      raw_json: newValue
    })
  }
}, { immediate: true })

// Format JSON handler
const formatJson = () => {
  try {
    const parsed = JSON.parse(jsonInput.value)
    jsonInput.value = JSON.stringify(parsed, null, 2)
  } catch {
    // Ignore formatting errors
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h3 class="text-lg font-medium">stdio/Local Server Configuration</h3>
      <p class="text-sm text-muted-foreground mt-1">
        Configure a local MCP server that runs as a command-line process
      </p>
    </div>

    <!-- JSON Input Component -->
    <ClaudeConfigJsonInput
      v-model="jsonInput"
      :is-valid="isValid"
      :has-error="!!validationError"
      @format="formatJson"
    />

    <!-- Validation Error -->
    <Alert v-if="validationError" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <AlertDescription>
        {{ validationError }}
      </AlertDescription>
    </Alert>

    <!-- Configuration Preview Component -->
    <ClaudeConfigPreview
      v-if="isValid"
      :server-name="extractedServerName"
      :command="extractedCommand"
      :env-vars="extractedEnvVars"
      :is-url-based-server="false"
      :headers="[]"
    />
  </div>
</template>
