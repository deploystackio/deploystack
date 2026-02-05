<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { DsCard } from '@/components/ui/ds-card'
import { ExternalLink, Calendar, Tag, RefreshCw, Github } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import InstallationStatusBadge from './InstallationStatusBadge.vue'
import GeneralMetricsPanel from './GeneralMetricsPanel.vue'
import DeploymentInfoCard from './DeploymentInfoCard.vue'
import McpServerInfoSpecifications from '@/components/mcp-server/view/McpServerInfoSpecifications.vue'
import { useMcpToolsStore } from '@/stores/mcpToolsStore'
// import { useMcpInstallationCache } from '@/composables/mcp-server/installation'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { getEnv } from '@/utils/env'
import type { McpInstallation, InstallationStatusData } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
  statusData: InstallationStatusData | null
  userTeamRole: 'team_admin' | 'team_user' | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  refresh: []
}>()
const { t } = useI18n()
const mcpToolsStore = useMcpToolsStore()
// const { currentTeam, userTeamRole } = useMcpInstallationCache()

// User can edit if they are team_admin
// const canEditInstallation = computed(() => userTeamRole.value === 'team_admin')

// Tools data
const toolCount = ref(0)
const serverDescription = ref<string | null>(null)
const lastRequestAt = ref<string | null>(null)

// Re-authentication state
const isReAuthenticating = ref(false)
const oauthPopup = ref<Window | null>(null)

// Computed properties for display (using installation.server data)
const server = computed(() => props.installation?.server || null)

// Show re-auth button when status is 'requires_reauth' and server requires OAuth
// OAuth is per-user, so all team members should be able to re-authenticate
const showReAuthButton = computed(() => {
  return props.statusData?.status === 'requires_reauth' &&
         server.value?.requires_oauth === true
})

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

// Format time ago
const formatTimeAgo = (dateString: string) => {
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

// Format last request time
const lastRequestTime = computed(() => {
  if (!lastRequestAt.value) return null
  const date = new Date(lastRequestAt.value)
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const timeAgo = formatTimeAgo(lastRequestAt.value)
  return `${time} (${timeAgo})`
})

// Status data from parent component
const statusMessage = computed(() => props.statusData?.status_message || null)

// Check if language and runtime are different
const showLanguageSeparately = computed(() => {
  if (!server.value) return false
  return server.value.language?.toLowerCase() !== server.value.runtime?.toLowerCase()
})

/**
 * Handle re-authentication flow
 * Opens OAuth popup and waits for completion
 */
const handleReAuthentication = async () => {
  try {
    isReAuthenticating.value = true

    if (!props.installation.team_id || !props.installation.id) {
      throw new Error('Missing team ID or installation ID')
    }

    // Call backend to start re-auth
    const response = await McpInstallationService.startReAuth(
      props.installation.team_id,
      props.installation.id
    )

    // Calculate popup position (centered on screen)
    const popupWidth = 600
    const popupHeight = 700
    const left = window.screenX + (window.outerWidth - popupWidth) / 2
    const top = window.screenY + (window.outerHeight - popupHeight) / 2

    // Open OAuth popup
    oauthPopup.value = window.open(
      response.authorization_url,
      'OAuth Re-authentication',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
    )

    if (!oauthPopup.value) {
      throw new Error(t('mcpInstallations.reauth.popup_blocked'))
    }

    // Show info toast
    toast.info(t('mcpInstallations.reauth.opening'), {
      description: t('mcpInstallations.reauth.opening_description')
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    toast.error(t('mcpInstallations.reauth.error'), {
      description: errorMessage
    })
  } finally {
    isReAuthenticating.value = false
  }
}

/**
 * Handle OAuth popup messages
 * Listens for oauth_reauth_success or oauth_error messages
 */
const handleReAuthMessage = (event: MessageEvent) => {
  // Verify origin
  const backendUrl = new URL(getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || 'http://localhost:3000')
  const allowedOrigins = [window.location.origin, backendUrl.origin]

  if (!allowedOrigins.includes(event.origin)) {
    console.warn('Rejected postMessage from unauthorized origin:', event.origin)
    return
  }

  // Handle success message
  if (event.data.type === 'oauth_reauth_success') {
    // Close popup
    if (oauthPopup.value && !oauthPopup.value.closed) {
      oauthPopup.value.close()
    }
    oauthPopup.value = null

    // Show success toast
    toast.success(t('mcpInstallations.reauth.success'), {
      description: t('mcpInstallations.reauth.success_description', {
        name: props.installation.installation_name || 'Server'
      })
    })

    // Emit refresh event to parent
    emit('refresh')
  }

  // Handle error message
  else if (event.data.type === 'oauth_error') {
    const { error } = event.data

    // Close popup
    if (oauthPopup.value && !oauthPopup.value.closed) {
      oauthPopup.value.close()
    }
    oauthPopup.value = null

    // Show error toast
    toast.error(t('mcpInstallations.reauth.error'), {
      description: error || t('mcpInstallations.reauth.error_description')
    })
  }
}

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

// Fetch last request time
async function fetchLastRequest() {
  try {
    const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
    const url = `${baseUrl}/api/teams/${props.installation.team_id}/mcp/installations/${props.installation.id}/requests?limit=1`

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch requests: ${response.status}`)
    }

    const result = await response.json()
    const requests = result.data?.requests || []

    if (requests.length > 0) {
      lastRequestAt.value = requests[0].created_at
    }
  } catch (error) {
    console.error('Failed to fetch last request:', error)
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

  // Fetch last request
  fetchLastRequest()

  // Add message listener for OAuth popup
  window.addEventListener('message', handleReAuthMessage)
})

onUnmounted(() => {
  // Remove message listener
  window.removeEventListener('message', handleReAuthMessage)

  // Close popup if still open
  if (oauthPopup.value && !oauthPopup.value.closed) {
    oauthPopup.value.close()
  }
})
</script>

<template>
  <div v-if="installation && server" class="space-y-6">
    <!-- Metrics Panel -->
    <GeneralMetricsPanel
      :team-id="installation.team_id"
      :installation-id="installation.id"
      :tool-count="toolCount"
    />

    <!-- MCP Status Card (no title) -->
    <DsCard>
      <dl class="divide-y divide-gray-100">
        <!-- MCP Status -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm/6 font-medium text-gray-900">MCP Status</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <InstallationStatusBadge :status-data="statusData" />
          </dd>
        </div>

        <!-- Status Message -->
        <div v-if="statusMessage" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm/6 font-medium text-gray-900">Status Message</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ statusMessage }}
          </dd>
        </div>

        <!-- Re-authenticate Button -->
        <div v-if="showReAuthButton" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm/6 font-medium text-gray-900">Action Required</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <Button
              @click="handleReAuthentication"
              :disabled="isReAuthenticating"
              variant="default"
              size="default"
            >
              <Spinner v-if="isReAuthenticating" class="mr-2 h-4 w-4" />
              <RefreshCw v-else class="mr-2 h-4 w-4" />
              {{ $t('mcpInstallations.reauth.button') }}
            </Button>
          </dd>
        </div>

        <!-- Last Request -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm/6 font-medium text-gray-900">Last Request</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <span v-if="lastRequestTime">{{ lastRequestTime }}</span>
            <span v-else class="text-muted-foreground">No recent requests found</span>
          </dd>
        </div>
      </dl>
    </DsCard>

    <!-- Deployment Info (GitHub only) -->
    <DeploymentInfoCard :installation="installation" :user-team-role="userTeamRole" @refresh="emit('refresh')" />

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

        <!-- MCP Specifications (Packages/Remotes) -->
        <div v-if="(server.runtime !== 'http' && server.packages) || (server.runtime === 'http' && server.remotes)" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm/6 font-medium text-gray-900">Specifications</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <McpServerInfoSpecifications
              :runtime="server.runtime"
              :packages="server.packages"
              :remotes="server.remotes"
              :show-heading="false"

              :template-args="server.template_args"
              :template-env="server.template_env"
              :template-headers="server.template_headers"

              :team-args-schema="server.team_args_schema"
              :team-env-schema="server.team_env_schema"
              :team-headers-schema="server.team_headers_schema"
              :team-url-query-params-schema="server.team_url_query_params_schema"

              :user-args-schema="server.user_args_schema"
              :user-env-schema="server.user_env_schema"
              :user-headers-schema="server.user_headers_schema"
              :user-url-query-params-schema="server.user_url_query_params_schema"
            />
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
              <div v-if="installation.updated_at" class="flex items-center gap-1">
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
