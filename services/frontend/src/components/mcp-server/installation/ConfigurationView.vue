<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Settings } from 'lucide-vue-next'
import {
  ConfigurationArgs,
  ConfigurationEnv,
  ConfigurationHeaders,
  ConfigurationQueryParams
} from './config'
import type { McpInstallation, UserConfiguration } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
  teamId: string
  canEdit?: boolean
  userRole?: 'team_admin' | 'team_user' | null
}

const props = withDefaults(defineProps<Props>(), {
  canEdit: true,
  userRole: null
})

const emit = defineEmits<{
  'installation-updated': [installation: McpInstallation]
  'configuration-updated': [config: UserConfiguration]
}>()

const { t } = useI18n()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serverData = ref<any>(null)
const isLoadingServer = ref(true)
const userConfigurations = ref<UserConfiguration[]>([])
const currentUserConfig = ref<UserConfiguration | null>(null)
const isLoadingUserConfig = ref(true)

const isTeamAdmin = computed(() => props.userRole === 'team_admin')

const isStdio = computed(() => {
  const transport = props.installation.server?.transport_type || serverData.value?.transport_type
  return transport === 'stdio'
})

const isRemote = computed(() => {
  const transport = props.installation.server?.transport_type || serverData.value?.transport_type
  return transport === 'http' || transport === 'sse'
})

// Helper function to safely parse schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSchema = (schema: any) => {
  if (!schema) return []
  try {
    return Array.isArray(schema) ? schema : JSON.parse(schema)
  } catch {
    return []
  }
}

// Check if any configuration schema exists
const hasAnyConfiguration = computed(() => {
  if (!serverData.value) return false

  // Check STDIO schemas
  if (isStdio.value) {
    const teamArgsSchema = getSchema(serverData.value.team_args_schema)
    const userArgsSchema = getSchema(serverData.value.user_args_schema)
    const teamEnvSchema = getSchema(serverData.value.team_env_schema)
    const userEnvSchema = getSchema(serverData.value.user_env_schema)

    return teamArgsSchema.length > 0 ||
           userArgsSchema.length > 0 ||
           teamEnvSchema.length > 0 ||
           userEnvSchema.length > 0
  }

  // Check HTTP/SSE schemas
  if (isRemote.value) {
    const teamHeadersSchema = getSchema(serverData.value.team_headers_schema)
    const userHeadersSchema = getSchema(serverData.value.user_headers_schema)
    const teamQueryParamsSchema = getSchema(serverData.value.team_url_query_params_schema)
    const userQueryParamsSchema = getSchema(serverData.value.user_url_query_params_schema)

    return teamHeadersSchema.length > 0 ||
           userHeadersSchema.length > 0 ||
           teamQueryParamsSchema.length > 0 ||
           userQueryParamsSchema.length > 0
  }

  return false
})

onMounted(async () => {
  try {
    isLoadingServer.value = true
    isLoadingUserConfig.value = true

    if (props.installation.server_id) {
      serverData.value = await McpCatalogService.getServerById(props.installation.server_id)
    }

    await loadUserConfigurations()
  } catch (error) {
    console.error('Error loading data:', error)
  } finally {
    isLoadingServer.value = false
    isLoadingUserConfig.value = false
  }
})

const loadUserConfigurations = async () => {
  try {
    const configs: UserConfiguration[] = await McpInstallationService.getUserConfigurations(
      props.teamId,
      props.installation.id
    )
    userConfigurations.value = configs

    if (configs.length > 0 && configs[0]) {
      currentUserConfig.value = configs[0]
    } else {
      currentUserConfig.value = null
    }
  } catch (error) {
    console.error('Error loading user configurations:', error)
    userConfigurations.value = []
    currentUserConfig.value = null
  }
}

const handleInstallationUpdated = (updatedInstallation: McpInstallation) => {
  emit('installation-updated', updatedInstallation)
}

const handleConfigurationUpdated = async (config: UserConfiguration) => {
  await loadUserConfigurations()
  emit('configuration-updated', config)
}
</script>

<template>
  <!-- Loading State with Skeleton -->
  <div v-if="isLoadingServer || isLoadingUserConfig" class="space-y-4">
    <Skeleton class="h-32 w-full rounded-lg" />
    <Skeleton class="h-32 w-full rounded-lg" />
    <Skeleton class="h-32 w-full rounded-lg" />
  </div>

  <div v-else class="space-y-0">
    <!-- Empty State: No Configuration -->
    <Empty v-if="!hasAnyConfiguration">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Settings />
        </EmptyMedia>
        <EmptyTitle>{{ t('mcpInstallations.details.config.noConfig.title') }}</EmptyTitle>
        <EmptyDescription>
          {{ t('mcpInstallations.details.config.noConfig.description') }}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>

    <!-- Configuration sections (only shown when config exists) -->
    <template v-else>
      <!-- STDIO TRANSPORT: Arguments + Environment Variables -->
      <ConfigurationArgs
        v-if="isStdio"
        :installation="installation"
        :server-data="serverData"
        :current-user-config="currentUserConfig"
        :team-id="teamId"
        :can-edit="canEdit"
        :is-team-admin="isTeamAdmin"
        @installation-updated="handleInstallationUpdated"
        @configuration-updated="handleConfigurationUpdated"
      />

      <ConfigurationEnv
        v-if="isStdio"
        :installation="installation"
        :server-data="serverData"
        :current-user-config="currentUserConfig"
        :team-id="teamId"
        :can-edit="canEdit"
        :is-team-admin="isTeamAdmin"
        @installation-updated="handleInstallationUpdated"
        @configuration-updated="handleConfigurationUpdated"
      />

      <!-- HTTP/SSE TRANSPORT: Headers + URL Query Parameters -->
      <ConfigurationHeaders
        v-if="isRemote"
        :installation="installation"
        :server-data="serverData"
        :current-user-config="currentUserConfig"
        :team-id="teamId"
        :can-edit="canEdit"
        :is-team-admin="isTeamAdmin"
        @installation-updated="handleInstallationUpdated"
        @configuration-updated="handleConfigurationUpdated"
      />

      <ConfigurationQueryParams
        v-if="isRemote"
        :installation="installation"
        :server-data="serverData"
        :current-user-config="currentUserConfig"
        :team-id="teamId"
        :can-edit="canEdit"
        :is-team-admin="isTeamAdmin"
        @installation-updated="handleInstallationUpdated"
        @configuration-updated="handleConfigurationUpdated"
      />
    </template>
  </div>
</template>
