<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { Spinner } from '@/components/ui/spinner'
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
  <div v-if="isLoadingServer || isLoadingUserConfig" class="flex items-center justify-center py-12">
    <Spinner class="h-8 w-8" />
  </div>

  <div v-else class="space-y-0">
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
  </div>
</template>
