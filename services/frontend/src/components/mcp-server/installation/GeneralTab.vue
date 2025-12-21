<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Badge } from '@/components/ui/badge'
import { DsCard } from '@/components/ui/ds-card'
import { Github, ExternalLink, Calendar, Tag } from 'lucide-vue-next'
import InstallationStatusBadge from './InstallationStatusBadge.vue'
import GeneralMetricsPanel from './GeneralMetricsPanel.vue'
import { useMcpToolsStore } from '@/stores/mcpToolsStore'
import { getEnv } from '@/utils/env'
import type { McpInstallation, InstallationStatusData } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
  statusData: InstallationStatusData | null
}

const props = defineProps<Props>()
const { t } = useI18n()
const mcpToolsStore = useMcpToolsStore()

// Tools data
const toolCount = ref(0)
const serverDescription = ref<string | null>(null)

// Computed properties for display (using installation.server data)
const server = computed(() => props.installation?.server || null)

const displayTags = computed(() => {
  if (!server.value?.tags || server.value.tags.length === 0) return []
  return Array.isArray(server.value.tags) ? server.value.tags : []
})

// Get language badge color
const getLanguageBadgeClass = (language: string | undefined) => {
  if (!language) return 'bg-gray-100 text-gray-800'

  const colors: Record<string, string> = {
    typescript: 'bg-blue-100 text-blue-800',
    javascript: 'bg-yellow-100 text-yellow-800',
    python: 'bg-green-100 text-green-800',
    go: 'bg-cyan-100 text-cyan-800',
    rust: 'bg-orange-100 text-orange-800',
    java: 'bg-red-100 text-red-800',
    csharp: 'bg-purple-100 text-purple-800',
  }
  return colors[language.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

// Format date for display
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

// Status data from parent component
const statusMessage = computed(() => props.statusData?.status_message || null)

// Check if language and runtime are different
const showLanguageSeparately = computed(() => {
  if (!server.value) return false
  return server.value.language?.toLowerCase() !== server.value.runtime?.toLowerCase()
})

// Fetch server description
async function fetchServerDescription() {
  if (!props.installation.server?.id) return

  try {
    const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
    const url = `${baseUrl}/api/mcp/servers/${props.installation.server.id}`

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch server description: ${response.status}`)
    }

    const result = await response.json()
    serverDescription.value = result.data?.description || null
  } catch (error) {
    console.error('Failed to fetch server description:', error)
  }
}

// Fetch tools count and server description on mount
onMounted(async () => {
  try {
    const response = await mcpToolsStore.fetchInstallationTools(
      props.installation.team_id,
      props.installation.id
    )
    toolCount.value = response.tool_count
  } catch (error) {
    console.error('Failed to fetch tools count:', error)
  }

  // Fetch server description
  fetchServerDescription()
})
</script>

<template>
  <div v-if="installation && server" class="space-y-6">
    <!-- Metrics Panel -->
    <GeneralMetricsPanel
      :status-data="statusData"
      :team-id="installation.team_id"
      :installation-id="installation.id"
      :tool-count="toolCount"
    />

    <!-- MCP Status Card -->
    <DsCard title="MCP Status">
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <InstallationStatusBadge :status-data="statusData" />
        </div>
        <div v-if="statusMessage" class="text-sm text-muted-foreground">
          {{ statusMessage }}
        </div>
      </div>
    </DsCard>

    <!-- Installation Details Card -->
    <DsCard title="Details">
      <dl class="divide-y divide-gray-100">
        <!-- MCP Server Description -->
        <div v-if="serverDescription" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm/6 font-medium text-gray-900">MCP Server Description</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ serverDescription }}
          </dd>
        </div>

        <!-- Satellite -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm/6 font-medium text-gray-900">Satellite</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <Badge :variant="installation.installation_type === 'global' ? 'default' : 'secondary'">
              {{ installation.installation_type }}
            </Badge>
          </dd>
        </div>

        <!-- Technical Specifications -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.technicalDetails') }}</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <div class="space-y-2">
              <div v-if="showLanguageSeparately" class="flex items-center gap-2">
                <span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.language') }}</span>
                <Badge
                  variant="outline"
                  :class="getLanguageBadgeClass(server.language)"
                >
                  {{ server.language || 'Unknown' }}
                </Badge>
              </div>
              <div><span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.runtime') }}</span> {{ server.runtime }}</div>
            </div>
          </dd>
        </div>

        <!-- Repository Links -->
        <div v-if="server.repository_url || server.website_url" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.links') }}</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <div class="space-y-2">
              <div v-if="server.repository_url" class="flex items-center gap-1">
                <Github class="h-4 w-4 text-muted-foreground" />
                <a
                  :href="server.repository_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 hover:underline"
                >
                  {{ t('mcpInstallations.details.installationDetails.fields.repository') }}
                  <ExternalLink class="inline h-3 w-3 ml-1" />
                </a>
              </div>
              <div v-if="server.website_url" class="flex items-center gap-1">
                <ExternalLink class="h-4 w-4 text-muted-foreground" />
                <a
                  :href="server.website_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 hover:underline"
                >
                  {{ t('mcpInstallations.details.installationDetails.fields.homepage') }}
                  <ExternalLink class="inline h-3 w-3 ml-1" />
                </a>
              </div>
            </div>
          </dd>
        </div>

        <!-- Author Information -->
        <div v-if="server.author_name" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.author') }}</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ server.author_name }}
          </dd>
        </div>

        <!-- Tags -->
        <div v-if="displayTags.length > 0" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.tags') }}</dt>
          <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
            <div class="flex flex-wrap gap-2">
              <Badge
                v-for="tag in displayTags"
                :key="tag"
                variant="outline"
                class="flex items-center gap-1"
              >
                <Tag class="h-3 w-3" />
                {{ tag }}
              </Badge>
            </div>
          </dd>
        </div>

        <!-- Installation Info -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.installationInfo') }}</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <div class="space-y-2">
              <div class="flex items-center gap-1">
                <Calendar class="h-4 w-4 text-muted-foreground" />
                <span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.installed') }}</span> {{ formatDate(installation.created_at) }}
              </div>
              <div class="flex items-center gap-1">
                <Calendar class="h-4 w-4 text-muted-foreground" />
                <span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.updated') }}</span> {{ formatDate(installation.updated_at) }}
              </div>
              <div v-if="installation.last_used_at" class="flex items-center gap-1">
                <Calendar class="h-4 w-4 text-muted-foreground" />
                <span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.lastUsed') }}</span> {{ formatDate(installation.last_used_at) }}
              </div>
              <div><span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.installationId') }}</span> <span class="font-mono text-xs">{{ installation.id }}</span></div>
            </div>
          </dd>
        </div>
      </dl>
    </DsCard>
  </div>
</template>
