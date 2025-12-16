<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { DsTabs, DsTabsItem } from '@/components/ui/ds-tabs'
import type { McpInstallation } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
  installationId: string
}

const props = defineProps<Props>()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

// Get environment variables count for badge
const environmentVariablesCount = computed(() => {
  if (!props.installation?.user_environment_variables) return 0
  return Object.keys(props.installation.user_environment_variables).length
})

// Map route names to tab values
const routeToTabMap: Record<string, string> = {
  'McpServerInstallationInformation': 'information',
  'McpServerInstallationMcpTools': 'mcp-tools',
  'McpServerInstallationUserConfig': 'user-config',
  'McpServerInstallationTeamConfig': 'team-config',
  'McpServerInstallationDangerZone': 'danger-zone',
}

// Map tab values to route names
const tabToRouteMap: Record<string, string> = {
  'information': 'McpServerInstallationInformation',
  'mcp-tools': 'McpServerInstallationMcpTools',
  'user-config': 'McpServerInstallationUserConfig',
  'team-config': 'McpServerInstallationTeamConfig',
  'danger-zone': 'McpServerInstallationDangerZone',
}

// Get current active tab from route name
const activeTab = computed({
  get: () => {
    const routeName = route.name as string
    return routeToTabMap[routeName] || 'information'
  },
  set: (value: string) => {
    const routeName = tabToRouteMap[value]
    if (routeName) {
      router.push({ name: routeName, params: { id: props.installationId } })
    }
  }
})
</script>

<template>
  <DsTabs v-model="activeTab" variant="underlined" class="mb-10">
    <DsTabsItem value="information" label="Installation Info" />
    <DsTabsItem value="mcp-tools" :label="t('mcpInstallations.details.mcpTools.title')" />
    <DsTabsItem value="user-config" label="User Configuration" />
    <DsTabsItem
      value="team-config"
      label="Team Configuration"
      :badge="environmentVariablesCount > 0 ? environmentVariablesCount : undefined"
    />
    <DsTabsItem value="danger-zone" label="Danger Zone" />
  </DsTabs>
</template>
