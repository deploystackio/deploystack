<script setup lang="ts">
import type { McpInstallation } from '@/types/mcp-installations'
import McpInstallationsList from './McpInstallationsList.vue'
import McpInstallationsEmptyState from './McpInstallationsEmptyState.vue'

interface Props {
  installations: McpInstallation[]
  hasInstallations: boolean
  showWalkthrough?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  installServer: []
  viewInstallation: [serverId: string]
  manageInstallation: [installationId: string]
  removeInstallation: [installationId: string]
}>()

const handleInstallServer = () => {
  emit('installServer')
}

const handleViewInstallation = (serverId: string) => {
  emit('viewInstallation', serverId)
}

const handleManageInstallation = (installationId: string) => {
  emit('manageInstallation', installationId)
}

const handleRemoveInstallation = (installationId: string) => {
  emit('removeInstallation', installationId)
}
</script>

<template>
  <!-- Empty State -->
  <McpInstallationsEmptyState
    v-if="!hasInstallations"
    @install-server="handleInstallServer"
  />

  <!-- Installations List -->
   <div v-else>
      <McpInstallationsList
        :installations="installations"
        :show-walkthrough="showWalkthrough"
        @view-installation="handleViewInstallation"
        @manage-installation="handleManageInstallation"
        @remove-installation="handleRemoveInstallation"
      />
   </div>

</template>
