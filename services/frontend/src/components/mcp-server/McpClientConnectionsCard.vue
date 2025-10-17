<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
import Card from '@/components/ui/card/Card.vue'
import { Item } from '@/components/ui/item'
import { McpClientActivityService } from '@/services/mcpClientActivityService'
import type { McpClientActivity } from '@/services/mcpClientActivityService'

const { t } = useI18n()
const eventBus = useEventBus()

const activities = ref<McpClientActivity[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let pollingInterval: number | null = null

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

async function fetchClientActivity() {
  const teamId = eventBus.getState<string>('selected_team_id')
  
  if (!teamId) {
    error.value = 'No team selected'
    console.warn('No team selected - please select a team first')
    return
  }
  
  try {
    isLoading.value = true
    error.value = null
    
    const response = await McpClientActivityService.getMyClientActivity(teamId, {
      limit: 20,
      active_within_minutes: 30
    })
    
    activities.value = response.data.activities
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('mcpServer.clientConnections.error.failed')
    console.error('Failed to fetch MCP client activity:', err)
  } finally {
    isLoading.value = false
  }
}

function startPolling() {
  pollingInterval = window.setInterval(() => {
    fetchClientActivity()
  }, 30000)
}

function stopPolling() {
  if (pollingInterval !== null) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

onMounted(async () => {
  await fetchClientActivity()
  startPolling()
  
  eventBus.on('team-selected', async () => {
    await fetchClientActivity()
  })
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <Card variant="gray">
    <div class="px-6">
      <h3 class="text-lg font-semibold mb-4">
        {{ t('mcpServer.clientConnections.title') }}
      </h3>
      
      <div v-if="isLoading && activities.length === 0" class="text-center py-8 text-muted-foreground">
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
      
      <div v-else-if="activities.length === 0" class="text-center py-8 text-muted-foreground">
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
