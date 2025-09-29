<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import McpServerInfoHeader from './McpServerInfoHeader.vue'
import McpServerInfoMetadata from './McpServerInfoMetadata.vue'
import McpServerInfoLinks from './McpServerInfoLinks.vue'
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
      <McpServerInfoHeader
        :name="server.name"
        :author-name="server.author_name"
        :organization="server.organization"
        :github-stars="server.github_stars"
        :github-account-id="server.github_account_id"
        :description="server.description"
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
          :category-id="server.category_id"
        />
      </div>

      <div class="border-t pt-4">
        <McpServerInfoLinks
          :github-url="server.github_url"
          :homepage-url="server.homepage_url"
        />
      </div>
    </div>
  </aside>
</template>
