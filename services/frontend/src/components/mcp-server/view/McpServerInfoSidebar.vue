<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import McpServerAvatar from '@/components/mcp-server/McpServerAvatar.vue'
import McpServerInfoHeader from './McpServerInfoHeader.vue'
import McpServerInfoMetadata from './McpServerInfoMetadata.vue'
import McpServerInfoLinks from './McpServerInfoLinks.vue'
import McpServerInfoSpecifications from './McpServerInfoSpecifications.vue'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'

interface Props {
  server: McpServer
}

defineProps<Props>()

const emit = defineEmits<{
  install: []
}>()

const { t } = useI18n()
</script>

<template>
  <aside class="w-full lg:w-80 xl:w-96 shrink-0">
    <div class="sticky top-6 space-y-6 border rounded-lg p-6 bg-card">
      <div class="flex justify-center">
        <McpServerAvatar
          :icon-url="server.icon_url"
          :server-name="server.name"
          :size="80"
          rounded="lg"
        />
      </div>

      <McpServerInfoHeader
        :name="server.name"
        :author-name="server.author_name"
        :organization="server.organization"
        :github-stars="server.github_stars"
        :github-account-id="server.github_account_id"
        :description="server.description"
        :repository-url="server.repository_url"
      />

      <Button
        @click="emit('install')"
        class="w-full"
        size="lg"
      >
        <Download class="h-4 w-4 mr-2" />
        {{ t('mcpInstallations.view.installServer') }}
      </Button>

      <div class="border-t pt-4">
        <McpServerInfoMetadata
          :tags="server.tags"
          :license="server.license"
          :runtime="server.runtime"
          :transport-type="server.transport_type"
          :category-id="server.category_id"
        />
      </div>

      <div class="border-t pt-4">
        <McpServerInfoLinks
          :repository-url="server.repository_url"
          :homepage-url="server.website_url"
        />
      </div>

      <div v-if="server.requires_oauth || (server.runtime !== 'http' && server.packages) || (server.runtime === 'http' && server.remotes)" class="border-t pt-4">
        <McpServerInfoSpecifications
          :requires-oauth="server.requires_oauth"
          :runtime="server.runtime"
          :packages="server.packages"
          :remotes="server.remotes"
        />
      </div>
    </div>
  </aside>
</template>
