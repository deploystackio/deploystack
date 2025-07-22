<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  Plus,
  PackagePlus
} from 'lucide-vue-next'
import type { McpInstallation } from '@/types/mcp-installations'
import McpInstallationsList from './McpInstallationsList.vue'

interface Props {
  installations: McpInstallation[]
  hasInstallations: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  installServer: []
  viewInstallation: [serverId: string]
  manageInstallation: [installationId: string]
  removeInstallation: [installationId: string]
}>()

const { t } = useI18n()

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
  <div v-if="!hasInstallations" class="pt-20">
    <button
      type="button"
      @click="handleInstallServer"
      class="relative block w-full max-w-2xl mx-auto rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 text-center hover:border-muted-foreground/40 hover:bg-muted/20 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden transition-all duration-200 group"
    >
      <div class="mx-auto size-16 text-muted-foreground/60 group-hover:text-muted-foreground/80 transition-colors duration-200">
        <PackagePlus class="w-full h-full" stroke-width="1.25" />
      </div>
      <div class="mt-4 space-y-2">
        <span class="block text-sm font-semibold text-foreground group-hover:text-foreground/90 transition-colors duration-200">
          {{ t('mcpInstallations.emptyState.title') }}
        </span>
        <span class="block text-sm text-muted-foreground group-hover:text-muted-foreground/80 transition-colors duration-200">
          {{ t('mcpInstallations.emptyState.description') }}
        </span>
        <div class="mt-4 inline-flex items-center gap-1.5 text-xs text-primary font-medium group-hover:text-primary/80 transition-colors duration-200">
          <Plus class="h-3.5 w-3.5" />
          {{ t('mcpInstallations.actions.install') }}
        </div>
      </div>
    </button>
  </div>

  <!-- Installations List -->
  <McpInstallationsList
    v-else
    :installations="installations"
    @view-installation="handleViewInstallation"
    @manage-installation="handleManageInstallation"
    @remove-installation="handleRemoveInstallation"
  />
</template>
