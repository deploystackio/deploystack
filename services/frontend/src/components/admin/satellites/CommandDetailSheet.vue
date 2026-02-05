<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SatelliteCommand } from '@/services/satelliteService'
import { CommandStatusBadge } from '@/components/admin/satellites'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, AlertTriangle, Clock, Loader2 } from 'lucide-vue-next'

interface Props {
  command: SatelliteCommand | null
  open: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()

// Parse JSON strings
const parsedPayload = computed(() => {
  if (!props.command?.payload) return null
  try {
    return JSON.parse(props.command.payload)
  } catch {
    return props.command.payload
  }
})

const parsedResult = computed(() => {
  if (!props.command?.result) return null
  try {
    return JSON.parse(props.command.result)
  } catch {
    return props.command.result
  }
})

// Format timestamp
function formatTimestamp(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Get status icon
function getStatusIcon(status: SatelliteCommand['status']) {
  switch (status) {
    case 'completed':
      return CheckCircle2
    case 'failed':
      return AlertTriangle
    case 'executing':
      return Loader2
    default:
      return Clock
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="overflow-y-auto sm:max-w-2xl">
      <SheetHeader v-if="command">
        <SheetTitle class="flex items-center gap-2">
          <component
            :is="getStatusIcon(command.status)"
            class="h-5 w-5"
            :class="{
              'text-green-600': command.status === 'completed',
              'text-amber-500': command.status === 'failed',
              'text-blue-600 animate-spin': command.status === 'executing',
              'text-muted-foreground': command.status === 'pending' || command.status === 'acknowledged'
            }"
          />
          {{ t('satellites.commands.detail.title') }}
        </SheetTitle>
        <SheetDescription>
          {{ t('satellites.commands.detail.description') }}
        </SheetDescription>
      </SheetHeader>

      <div v-if="command" class="space-y-6 py-6">
        <!-- Command ID -->
        <div>
          <div class="text-sm font-medium text-muted-foreground mb-1">
            {{ t('satellites.commands.detail.commandId') }}
          </div>
          <div class="text-sm font-mono bg-muted p-2 rounded-md">
            {{ command.id }}
          </div>
        </div>

        <!-- Type and Status -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-sm font-medium text-muted-foreground mb-1">
              {{ t('satellites.commands.detail.type') }}
            </div>
            <Badge variant="outline">{{ command.command_type }}</Badge>
          </div>
          <div>
            <div class="text-sm font-medium text-muted-foreground mb-1">
              {{ t('satellites.commands.detail.status') }}
            </div>
            <CommandStatusBadge :status="command.status" />
          </div>
        </div>

        <!-- Priority -->
        <div>
          <div class="text-sm font-medium text-muted-foreground mb-1">
            {{ t('satellites.commands.detail.priority') }}
          </div>
          <Badge
            :variant="command.priority === 'immediate' || command.priority === 'high' ? 'default' : 'secondary'"
            :class="{
              'bg-red-600': command.priority === 'immediate',
              'bg-orange-600': command.priority === 'high'
            }"
          >
            {{ command.priority }}
          </Badge>
        </div>

        <Separator />

        <!-- Payload -->
        <div>
          <div class="text-sm font-medium text-muted-foreground mb-2">
            {{ t('satellites.commands.detail.payload') }}
          </div>
          <pre class="text-xs bg-muted p-3 rounded-md overflow-x-auto">{{ JSON.stringify(parsedPayload, null, 2) }}</pre>
        </div>

        <!-- Result -->
        <div v-if="parsedResult">
          <div class="text-sm font-medium text-muted-foreground mb-2">
            {{ t('satellites.commands.detail.result') }}
          </div>
          <pre class="text-xs bg-muted p-3 rounded-md overflow-x-auto">{{ JSON.stringify(parsedResult, null, 2) }}</pre>
        </div>

        <!-- Error Message -->
        <div v-if="command.error_message">
          <div class="text-sm font-medium text-muted-foreground mb-2">
            {{ t('satellites.commands.detail.error') }}
          </div>
          <div class="text-sm bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100 p-3 rounded-md">
            {{ command.error_message }}
          </div>
        </div>

        <Separator />

        <!-- Retry Information -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-sm font-medium text-muted-foreground mb-1">
              {{ t('satellites.commands.detail.retryCount') }}
            </div>
            <div class="text-sm">{{ command.retry_count }}</div>
          </div>
          <div>
            <div class="text-sm font-medium text-muted-foreground mb-1">
              {{ t('satellites.commands.detail.maxRetries') }}
            </div>
            <div class="text-sm">{{ command.max_retries }}</div>
          </div>
        </div>

        <!-- Correlation ID -->
        <div v-if="command.correlation_id">
          <div class="text-sm font-medium text-muted-foreground mb-1">
            {{ t('satellites.commands.detail.correlationId') }}
          </div>
          <div class="text-sm font-mono">{{ command.correlation_id }}</div>
        </div>

        <!-- Target Team -->
        <div v-if="command.target_team_id">
          <div class="text-sm font-medium text-muted-foreground mb-1">
            {{ t('satellites.commands.detail.targetTeam') }}
          </div>
          <div class="text-sm">{{ command.target_team_id }}</div>
        </div>

        <!-- Created By -->
        <div v-if="command.created_by">
          <div class="text-sm font-medium text-muted-foreground mb-1">
            {{ t('satellites.commands.detail.createdBy') }}
          </div>
          <div class="text-sm">{{ command.created_by }}</div>
        </div>

        <Separator />

        <!-- Timestamps -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-sm font-medium text-muted-foreground mb-1">
              {{ t('satellites.commands.detail.createdAt') }}
            </div>
            <div class="text-sm">{{ formatTimestamp(command.created_at) }}</div>
          </div>
          <div>
            <div class="text-sm font-medium text-muted-foreground mb-1">
              {{ t('satellites.commands.detail.updatedAt') }}
            </div>
            <div class="text-sm">{{ formatTimestamp(command.updated_at) }}</div>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
