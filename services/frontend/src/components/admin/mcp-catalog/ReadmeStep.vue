<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useEventBus } from '@/composables/useEventBus'
import type { McpServerFormData } from '../../../views/admin/mcp-server-catalog/types'

interface Props {
  modelValue: McpServerFormData['readme']
  formData: McpServerFormData
}

interface Emits {
  (e: 'update:modelValue', value: McpServerFormData['readme']): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const eventBus = useEventBus()

// Storage key for this step
const STORAGE_KEY = 'edit_readme_data'

// Form state - store as plain markdown text
const readmeMarkdown = ref('')

// Load data from storage on mount
const loadFromStorage = () => {
  const stored = eventBus.getState<{ readme_markdown: string }>(STORAGE_KEY)
  if (stored) {
    readmeMarkdown.value = stored.readme_markdown || ''
  } else if (props.modelValue && props.modelValue.github_readme_base64) {
    // Decode base64 to markdown for editing
    try {
      readmeMarkdown.value = atob(props.modelValue.github_readme_base64)
    } catch {
      readmeMarkdown.value = ''
    }
  }
}

// Save data to storage
const saveToStorage = () => {
  const data = {
    readme_markdown: readmeMarkdown.value
  }
  eventBus.setState(STORAGE_KEY, data)
  // Note: We'll convert to base64 only on final submit
  emit('update:modelValue', { github_readme_base64: '' })
}

// Watch for changes and auto-save to storage
watch([readmeMarkdown], () => {
  saveToStorage()
})

// Initialize on mount
onMounted(() => {
  loadFromStorage()
})
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-4">
      <!-- README Input -->
      <div class="space-y-2">
        <Label for="readme-content">README Content (Markdown)</Label>
        <Textarea
          id="readme-content"
          v-model="readmeMarkdown"
          placeholder="# My MCP Server&#10;&#10;Description of the server...&#10;&#10;## Features&#10;&#10;- Feature 1&#10;- Feature 2"
          class="min-h-[400px] font-mono text-sm"
        />
        <p class="text-sm text-muted-foreground">
          Enter your README content in Markdown format. It will be automatically converted to base64 when you submit.
        </p>
      </div>
    </div>
  </div>
</template>
