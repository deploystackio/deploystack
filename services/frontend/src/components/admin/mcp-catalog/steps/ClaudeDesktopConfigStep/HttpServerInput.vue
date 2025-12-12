<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, CheckCircle } from 'lucide-vue-next'

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
  // Allow empty URLs (optional field)
  if (!url.trim()) {
    return { isValid: false, error: null }
  }

  try {
    const parsedUrl = new URL(url)

    // Must use HTTP or HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { isValid: false, error: 'URL must use HTTP or HTTPS protocol' }
    }

    // Must have a valid hostname (not empty, not just a single character)
    const hostname = parsedUrl.hostname
    if (!hostname || hostname.length < 2) {
      return { isValid: false, error: 'Invalid hostname' }
    }

    // For non-localhost, require at least one dot (domain.tld format)
    if (hostname !== 'localhost' && !hostname.includes('.')) {
      return { isValid: false, error: 'Invalid domain format' }
    }

    return { isValid: true, error: null }
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
    validationError.value = validation.error
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
const hasUrl = computed(() => urlInput.value.trim().length > 0)
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
        <div v-if="hasUrl" class="flex items-center gap-2">
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

  </div>
</template>
