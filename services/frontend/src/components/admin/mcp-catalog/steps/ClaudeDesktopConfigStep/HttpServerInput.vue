<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, CheckCircle, Link as LinkIcon } from 'lucide-vue-next'

interface Props {
  modelValue?: {
    url: string
    type: 'http' | 'sse'  // Simplified for transport_type column
  }
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({
    url: '',
    type: 'http'  // Default to 'http' for transport_type
  })
})
const emit = defineEmits<{
  'update:modelValue': [value: { url: string; type: 'http' | 'sse' }]
}>()

// Local state
const urlInput = ref(props.modelValue?.url || '')
const transportType = ref<'http' | 'sse'>(props.modelValue?.type || 'http')
const validationError = ref<string | null>(null)
const isValid = ref(false)

// Validate URL
const validateUrl = (url: string) => {
  if (!url.trim()) {
    return { isValid: false, error: 'URL is required' }
  }

  try {
    const parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { isValid: false, error: 'URL must use HTTP or HTTPS protocol' }
    }
    return { isValid: true }
  } catch {
    return { isValid: false, error: 'Please enter a valid URL' }
  }
}

// Emit updated configuration
const emitUpdate = () => {
  const validation = validateUrl(urlInput.value)

  if (validation.isValid) {
    validationError.value = null
    isValid.value = true

    emit('update:modelValue', {
      url: urlInput.value,
      type: transportType.value
    })
  } else {
    validationError.value = validation.error || 'Invalid URL'
    isValid.value = false

    // Still emit for editing purposes
    emit('update:modelValue', {
      url: urlInput.value,
      type: transportType.value
    })
  }
}

// Watch for input changes and validate
watch([urlInput, transportType], () => {
  emitUpdate()
}, { immediate: true })

// Computed properties
const statusIcon = computed(() => isValid.value ? CheckCircle : AlertCircle)
const statusColor = computed(() => isValid.value ? 'text-green-600' : 'text-red-600')
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h3 class="text-lg font-medium">Remote Server Configuration</h3>
      <p class="text-sm text-muted-foreground mt-1">
        Configure a remote MCP server accessible via HTTP-based transport
      </p>
    </div>

    <!-- Transport Type Selection -->
    <div class="space-y-2">
      <Label for="transport-type">Transport Type</Label>
      <Select v-model="transportType">
        <SelectTrigger id="transport-type">
          <SelectValue placeholder="Select transport type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="http">
            Streamable HTTP
          </SelectItem>
          <SelectItem value="sse">
            SSE (Server-Sent Events)
          </SelectItem>
        </SelectContent>
      </Select>
      <p class="text-xs text-muted-foreground">
        Choose the transport protocol for communicating with your MCP server
      </p>
    </div>

    <!-- URL Input -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <Label for="server-url">Server URL</Label>
        <div class="flex items-center gap-2">
          <component :is="statusIcon" :class="['h-4 w-4', statusColor]" />
          <span :class="['text-sm', statusColor]">
            {{ isValid ? 'Valid URL' : 'Invalid URL' }}
          </span>
        </div>
      </div>

      <Input
        id="server-url"
        v-model="urlInput"
        type="url"
        :placeholder="transportType === 'sse' ? 'https://example.com/mcp/sse' : 'https://example.com/mcp'"
        :class="{ 'border-destructive': validationError }"
      />

      <p class="text-xs text-muted-foreground">
        Enter the URL where your MCP server is hosted (HTTPS recommended)
      </p>
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
        <CardTitle class="text-sm text-green-800">Configuration Preview</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <div>
          <Label class="text-xs text-green-700">Transport Type</Label>
          <code class="ml-2 text-sm bg-green-100 px-2 py-1 rounded">
            {{ transportType === 'sse' ? 'SSE (Server-Sent Events)' : 'HTTP (Streamable)' }}
          </code>
        </div>
        <div>
          <Label class="text-xs text-green-700">Server URL</Label>
          <div class="flex items-center gap-2 mt-1">
            <LinkIcon class="h-4 w-4 text-green-600" />
            <code class="text-sm bg-green-100 px-2 py-1 rounded break-all">{{ urlInput }}</code>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
