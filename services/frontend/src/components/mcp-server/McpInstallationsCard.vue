<script setup lang="ts">
import type { McpInstallation } from '@/types/mcp-installations'
import McpInstallationsList from './McpInstallationsList.vue'

interface Props {
  installations: McpInstallation[]
  showWalkthrough?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  viewInstallation: [serverId: string]
  manageInstallation: [installationId: string]
  removeInstallation: [installationId: string]
}>()

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
  <McpInstallationsList
    :installations="installations"
    :show-walkthrough="showWalkthrough"
    @view-installation="handleViewInstallation"
    @manage-installation="handleManageInstallation"
    @remove-installation="handleRemoveInstallation"
  />
</template>
