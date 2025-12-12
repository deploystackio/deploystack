<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
import { useSSE } from '@/composables/useSSE'
import Card from '@/components/ui/card/Card.vue'
import { Item } from '@/components/ui/item'
import { McpClientActivityService } from '@/services/mcpClientActivityService'
import type { McpClientActivity } from '@/services/mcpClientActivityService'

const { t } = useI18n()
const eventBus = useEventBus()

const {
  data: activities,
  isLoading,
  error,
  connect,
  disconnect
} = useSSE<McpClientActivity[]>('client_activity')

function getRelativeTime(isoString: string): string {
  const now = new Date()
  const activityDate = new Date(isoString)
  const diffMs = now.getTime() - activityDate.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return t('mcpServer.clientConnections.activity.justNow')
  if (diffMinutes === 1) return t('mcpServer.clientConnections.activity.minuteAgo')
  if (diffMinutes < 60) return t('mcpServer.clientConnections.activity.minutesAgo', { count: diffMinutes })

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours === 1) return t('mcpServer.clientConnections.activity.hourAgo')
  if (diffHours < 24) return t('mcpServer.clientConnections.activity.hoursAgo', { count: diffHours })

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return t('mcpServer.clientConnections.activity.dayAgo')
  return t('mcpServer.clientConnections.activity.daysAgo', { count: diffDays })
}

function connectToTeam(teamId: string) {
  const url = McpClientActivityService.getStreamUrl(teamId, {
    limit: 20,
    active_within_minutes: 30
  })
  connect(url)
}

function handleTeamChange() {
  const teamId = eventBus.getState<string>('selected_team_id')
  if (teamId) {
    connectToTeam(teamId)
  } else {
    disconnect()
  }
}

// Fallback fetch for retry button
async function fetchClientActivity() {
  const teamId = eventBus.getState<string>('selected_team_id')
  if (teamId) {
    connectToTeam(teamId)
  }
}

onMounted(() => {
  const teamId = eventBus.getState<string>('selected_team_id')
  if (teamId) {
    connectToTeam(teamId)
  }
  eventBus.on('team-selected', handleTeamChange)
})

onUnmounted(() => {
  eventBus.off('team-selected', handleTeamChange)
})
</script>

<template>
  <Card variant="gray">
    <div class="px-6">
      <h3 class="text-lg font-semibold mb-4">
        {{ t('mcpServer.clientConnections.title') }}
      </h3>

      <div v-if="isLoading && !activities?.length" class="text-center py-8 text-muted-foreground">
        {{ t('mcpServer.clientConnections.loading') }}
      </div>

      <div v-else-if="error" class="text-center py-8">
        <p class="text-sm text-destructive mb-2">{{ error }}</p>
        <button
          @click="fetchClientActivity"
          class="text-sm text-primary hover:underline"
        >
          {{ t('mcpServer.clientConnections.error.retry') }}
        </button>
      </div>

      <div v-else-if="!activities?.length" class="text-center py-8 text-muted-foreground">
        <p class="mb-2">{{ t('mcpServer.clientConnections.empty.title') }}</p>
        <p class="text-xs">{{ t('mcpServer.clientConnections.empty.description') }}</p>
      </div>

      <div v-else class="space-y-3">
        <Item
          v-for="activity in activities"
          :key="activity.id"
          variant="filled"
          class="cursor-pointer"
        >
          <div class="flex items-center justify-between w-full">
            <div class="flex flex-col">
              <span class="font-medium">
                {{ activity.client_name || t('mcpServer.clientConnections.client.unknown') }}
              </span>
              <span class="text-sm text-muted-foreground">{{ activity.satellite.name }}</span>
            </div>
            <div class="flex flex-col items-end">
              <span class="text-xs text-muted-foreground">
                {{ getRelativeTime(activity.last_activity_at) }}
              </span>
              <span class="text-xs text-green-600 font-medium">
                {{ t('mcpServer.clientConnections.activity.stats', {
                  requests: activity.total_requests,
                  tools: activity.total_tool_calls
                }) }}
              </span>
            </div>
          </div>
        </Item>
      </div>
    </div>
  </Card>
</template>
