<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import McpServerAvatar from '@/components/mcp-server/McpServerAvatar.vue'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'

interface Props {
  server: McpServer | null
  isLoading?: boolean
}

defineProps<Props>()
const { t } = useI18n()
</script>

<template>
  <!-- When server is loaded -->
  <DsPageHeading v-if="server" :title="server.name" :show-border="false">
    <template #icon>
      <McpServerAvatar
        :icon-url="server.icon_url"
        :server-name="server.name"
        size="md"
        rounded="lg"
        class="mr-3"
      />
    </template>

    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <RouterLink to="/admin/mcp-server-catalog">
              {{ t('mcpCatalog.title') }}
            </RouterLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{{ server.name }}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>

    <template #actions>
      <slot name="actions" />
    </template>
  </DsPageHeading>

  <!-- Loading state (shows skeleton breadcrumb) -->
  <DsPageHeading v-else :title="t('mcpCatalog.edit.titleLoading')" :show-border="false">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <RouterLink to="/admin/mcp-server-catalog">
              {{ t('mcpCatalog.title') }}
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
