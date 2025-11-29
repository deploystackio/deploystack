<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import DashboardLayout from '@/components/DashboardLayout.vue'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Library } from 'lucide-vue-next'

const { t } = useI18n()
const { setBreadcrumbs } = useBreadcrumbs()

onMounted(() => {
  setBreadcrumbs([
    { label: t('mcpInstallations.title', 'MCP Server Installations'), href: '/mcp-server' },
    { label: t('mcpInstallations.catalog.title', 'MCP Server Catalog') }
  ])
})
</script>

<template>
  <DashboardLayout>
    <div class="space-y-6 pb-16">
      <Empty class="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Library />
          </EmptyMedia>
          <EmptyTitle>{{ t('mcpInstallations.catalog.emptyState.title', 'MCP Server Catalog') }}</EmptyTitle>
          <EmptyDescription>
            {{ t('mcpInstallations.catalog.emptyState.description', 'Browse all available MCP servers. Coming soon.') }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  </DashboardLayout>
</template>
