<script setup lang="ts">
import { ref, watch } from 'vue'
import { DsTabs, DsTabsItem } from '@/components/ui/ds-tabs'
import { Globe, Terminal } from 'lucide-vue-next'
import HttpServerInput from './steps/ClaudeDesktopConfigStep/HttpServerInput.vue'
import StdioServerInput from './steps/ClaudeDesktopConfigStep/StdioServerInput.vue'

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

// Local state
const activeTab = ref<'http' | 'stdio'>('http') // HTTP is default

// Separate state for each transport type
const httpConfig = ref({
  url: '',
  type: 'http' as const  // Simplified type for transport_type column
})

const stdioConfig = ref({
  claude_desktop_config: props.modelValue.claude_desktop_config || {},
  raw_json: props.modelValue.raw_json || ''
})

// Watch for config changes and emit based on active tab
watch([httpConfig, stdioConfig, activeTab], () => {
  if (activeTab.value === 'http') {
    // For HTTP, we create a fake claude_desktop_config structure
    const httpClaudeConfig = {
      mcpServers: {
        'remote-server': {
          url: httpConfig.value.url,
          type: httpConfig.value.type
        }
      }
    }
    emit('update:modelValue', {
      claude_desktop_config: httpClaudeConfig,
      raw_json: JSON.stringify(httpClaudeConfig, null, 2)
    })
  } else {
    // For stdio, use the actual config
    emit('update:modelValue', stdioConfig.value)
  }
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-muted-foreground">
      Choose how your MCP server will be accessed.
    </p>

    <!-- Transport Type Tabs -->
    <DsTabs v-model="activeTab" variant="pills">
      <DsTabsItem value="http" label="HTTP/Remote">
        <template #icon>
          <Globe class="h-4 w-4" />
        </template>
      </DsTabsItem>
      <DsTabsItem value="stdio" label="stdio/Local">
        <template #icon>
          <Terminal class="h-4 w-4" />
        </template>
      </DsTabsItem>
    </DsTabs>

    <!-- Tab Content -->
    <div class="mt-6">
      <!-- HTTP/Remote Tab Content -->
      <HttpServerInput
        v-if="activeTab === 'http'"
        v-model="httpConfig"
      />

      <!-- stdio/Local Tab Content -->
      <StdioServerInput
        v-else-if="activeTab === 'stdio'"
        v-model="stdioConfig"
      />
    </div>
  </div>
</template>
