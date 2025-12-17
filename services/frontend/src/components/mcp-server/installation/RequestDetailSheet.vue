<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-vue-next'
import type { McpRequestLog } from '@/types/mcp-request-logs'

interface Props {
  request: McpRequestLog | null
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

const copiedField = ref<string | null>(null)

function handleOpenChange(value: boolean) {
  emit('update:open', value)
}

async function copyToClipboard(text: string, field: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = field
    setTimeout(() => {
      copiedField.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="handleOpenChange">
    <SheetContent class="sm:max-w-2xl overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{{ t('mcpInstallations.details.requests.detail.title') }}</SheetTitle>
        <SheetDescription v-if="request">
          {{ t('mcpInstallations.details.requests.detail.toolName') }}: {{ request.tool_name }}
        </SheetDescription>
      </SheetHeader>

      <div v-if="request" class="px-4 pb-4 space-y-6">
        <div class="space-y-2">
          <div class="text-sm">
            <span class="font-medium">{{ t('mcpInstallations.details.requests.detail.user') }}:</span>
            <span v-if="request.user" class="text-muted-foreground ml-1">
              {{ request.user.user_name }} ({{ request.user.email }})
            </span>
            <span v-else class="text-muted-foreground ml-1">—</span>
          </div>

          <div class="text-sm">
            <span class="font-medium">{{ t('mcpInstallations.details.requests.detail.responseTime') }}:</span>
            <span class="text-muted-foreground ml-1">{{ request.response_time_ms }}ms</span>
          </div>

          <div class="text-sm">
            <span class="font-medium">{{ t('mcpInstallations.details.requests.detail.status') }}:</span>
            <span v-if="request.success" class="text-green-600 ml-1">{{ t('mcpInstallations.details.requests.table.values.success') }}</span>
            <span v-else class="text-red-600 ml-1">{{ t('mcpInstallations.details.requests.table.values.failed') }}</span>
          </div>

          <div class="text-sm">
            <span class="font-medium">{{ t('mcpInstallations.details.requests.detail.timestamp') }}:</span>
            <span class="text-muted-foreground ml-1 font-mono">{{ request.created_at }}</span>
          </div>
        </div>

        <div v-if="request.error_message">
          <div class="text-sm font-medium mb-2">{{ t('mcpInstallations.details.requests.detail.error') }}</div>
          <div class="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-3 rounded-md">
            {{ request.error_message }}
          </div>
        </div>

        <!-- Timeline Flow -->
        <div class="space-y-4">
          <!-- Request Started -->
          <div class="flex items-center gap-2">
            <svg fill="none" height="10" viewBox="0 0 10 10" width="10" xmlns="http://www.w3.org/2000/svg">
              <circle cx="5" cy="5" r="4.25" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground"></circle>
            </svg>
            <span class="text-sm font-medium">Request started</span>
          </div>

          <!-- Arrow Down -->
          <div class="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-muted-foreground" style="margin-left: -3px;">
              <path d="M8 2V14M8 14L4 10M8 14L12 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <!-- Parameters Box -->
          <div class="rounded-md border border-border bg-muted/30">
            <div class="rounded-md bg-background border-border px-3 py-2">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium">{{ t('mcpInstallations.details.requests.detail.parameters') }}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  @click="copyToClipboard(JSON.stringify(request.tool_params, null, 2), 'params')"
                >
                  <Check v-if="copiedField === 'params'" class="h-4 w-4" />
                  <Copy v-else class="h-4 w-4" />
                </Button>
              </div>
              <pre class="bg-muted p-3 rounded-md text-xs overflow-x-auto">{{ JSON.stringify(request.tool_params, null, 2) }}</pre>
            </div>
          </div>

          <!-- Arrow Down -->
          <div class="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-muted-foreground" style="margin-left: -3px;">
              <path d="M8 2V14M8 14L4 10M8 14L12 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <!-- Response Box -->
          <div class="rounded-md border border-border bg-muted/30">
            <div class="rounded-md bg-background border-border px-3 py-2">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium">{{ t('mcpInstallations.details.requests.detail.response') }}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  @click="copyToClipboard(JSON.stringify(request.tool_response, null, 2), 'response')"
                >
                  <Check v-if="copiedField === 'response'" class="h-4 w-4" />
                  <Copy v-else class="h-4 w-4" />
                </Button>
              </div>
              <pre class="bg-muted p-3 rounded-md text-xs overflow-x-auto">{{ JSON.stringify(request.tool_response, null, 2) }}</pre>
            </div>
          </div>

          <!-- Arrow Down -->
          <div class="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-muted-foreground" style="margin-left: -3px;">
              <path d="M8 2V14M8 14L4 10M8 14L12 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <!-- Request Finished -->
          <div class="flex items-center gap-2">
            <svg fill="none" height="10" viewBox="0 0 10 10" width="10" xmlns="http://www.w3.org/2000/svg">
              <circle cx="5" cy="5" r="4.25" stroke="currentColor" stroke-width="1.5" :class="request.success ? 'text-green-600' : 'text-red-600'"></circle>
              <circle cx="5" cy="5" r="2.5" :class="request.success ? 'fill-green-600' : 'fill-red-600'"></circle>
            </svg>
            <span class="text-sm font-medium">Request finished in {{ request.response_time_ms }}ms</span>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
