<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Layers } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'
import McpServerAvatar from './McpServerAvatar.vue'

interface Props {
  limit?: number
}

const props = withDefaults(defineProps<Props>(), {
  limit: 8
})

const { t } = useI18n()
const router = useRouter()

const featuredServers = ref<McpServer[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

const fetchFeaturedServers = async () => {
  try {
    isLoading.value = true
    error.value = null

    const response = await McpCatalogService.getGlobalServersPaginated(
      { featured: true },
      { limit: props.limit, offset: 0 }
    )

    featuredServers.value = response.items
  } catch (err) {
    console.error('Error fetching featured servers:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load featured servers'
    featuredServers.value = []
  } finally {
    isLoading.value = false
  }
}

const handleServerClick = (server: McpServer) => {
  router.push(`/mcp-server/install/${server.id}`)
}

const handleBrowseCatalog = () => {
  router.push('/mcp-server/search')
}

const truncateDescription = (description: string | null | undefined, maxLength: number = 80) => {
  if (!description) return 'No description available'
  if (description.length <= maxLength) return description
  return description.substring(0, maxLength) + '...'
}

onMounted(() => {
  fetchFeaturedServers()
})
</script>

<template>
  <div class="flex flex-col items-center justify-start gap-6 p-6 border border-solid rounded-lg">
    <Layers class="h-5 w-5 text-muted-foreground" />

    <p class="text-base font-medium text-center">
      {{ t('mcpInstallations.featuredList.title') }}
    </p>

    <div v-if="isLoading" class="flex flex-col items-stretch justify-start gap-4 w-full">
      <div v-for="i in 5" :key="i" class="flex flex-row items-center gap-3">
        <Skeleton class="h-9 w-9 rounded-md" />
        <div class="flex flex-col gap-1 flex-1">
          <Skeleton class="h-4 w-32" />
          <Skeleton class="h-3 w-full" />
        </div>
      </div>
    </div>

    <div v-else-if="error" class="text-center py-4">
      <p class="text-sm text-destructive">{{ error }}</p>
      <Button
        variant="outline"
        size="sm"
        @click="fetchFeaturedServers"
        class="mt-2"
      >
        {{ t('actions.retry') }}
      </Button>
    </div>

    <div v-else-if="featuredServers.length === 0" class="text-center py-4">
      <p class="text-sm text-muted-foreground">
        {{ t('mcpInstallations.featured.noServers') }}
      </p>
    </div>

    <div v-else class="flex flex-col items-stretch justify-start gap-4 w-full">
      <button
        v-for="server in featuredServers"
        :key="server.id"
        type="button"
        @click="handleServerClick(server)"
        class="flex flex-row items-start gap-3 text-left hover:bg-muted/50 rounded-md p-2 -mx-2 transition-colors"
      >
        <McpServerAvatar
          :icon-url="server.icon_url"
          :server-name="server.name"
          size="sm"
          rounded="md"
          class="shrink-0"
        />
        <div class="flex flex-col items-stretch justify-start min-w-0">
          <p class="text-sm font-medium truncate">{{ server.name }}</p>
          <p class="text-xs text-muted-foreground line-clamp-2">
            {{ truncateDescription(server.description) }}
          </p>
        </div>
      </button>
    </div>

    <div class="w-full border-t border-border" />

    <Button
      variant="outline"
      @click="handleBrowseCatalog"
      class="w-full"
    >
      {{ t('mcpInstallations.featuredList.browseCatalog') }}
    </Button>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
