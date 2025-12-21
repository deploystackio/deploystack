<script setup lang="ts">
import { ref } from 'vue'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import McpServerAvatar from '@/components/mcp-server/McpServerAvatar.vue'
import InstallationStatusBadge from './InstallationStatusBadge.vue'
import { RefreshCw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { McpInstallation, InstallationStatusData } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation | null
  statusData: InstallationStatusData | null
  isLoading?: boolean
}

withDefaults(defineProps<Props>(), {
  isLoading: false
})

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()

const isRefreshing = ref(false)

const handleRefresh = async () => {
  isRefreshing.value = true
  try {
    emit('refresh')
    // Wait a bit for visual feedback
    await new Promise(resolve => setTimeout(resolve, 500))
  } finally {
    isRefreshing.value = false
  }
}
</script>

<template>
  <DsPageHeading v-if="installation" :title="installation.installation_name" :show-border="false">
    <template #icon>
      <Skeleton v-if="!installation.server" class="h-12 w-12 rounded-md" />
      <McpServerAvatar
        v-else
        :icon-url="installation.server.icon_url"
        :server-name="installation.server.name"
        size="md"
      />
    </template>

    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <RouterLink to="/mcp-server">
              {{ t('mcpInstallations.title') }}
            </RouterLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{{ installation.installation_name }}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>

    <template #actions>
      <InstallationStatusBadge :status-data="statusData" size="default" />
      <Button
        variant="outline"
        size="icon"
        :disabled="isRefreshing"
        @click="handleRefresh"
        class="w-10 h-10"
      >
        <Spinner v-if="isRefreshing" class="h-4 w-4" />
        <RefreshCw v-else class="h-4 w-4" />
      </Button>
    </template>
  </DsPageHeading>
  <DsPageHeading v-else :title="t('mcpInstallations.title')" :show-border="false">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <RouterLink to="/mcp-server">
              {{ t('mcpInstallations.title') }}
            </RouterLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <Skeleton class="h-4 w-48" />
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  </DsPageHeading>
</template>
