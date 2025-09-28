<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Loader2, Github, Code } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'

interface Props {
  title?: string
  description?: string
  limit?: number
  showTitle?: boolean
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
  limit: 6,
  showTitle: true,
  compact: false
})

const emit = defineEmits<{
  serverSelected: [server: McpServer]
}>()

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

// State
const featuredServers = ref<McpServer[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

// Computed
const displayTitle = computed(() => {
  return props.title || t('mcpInstallations.featured.title')
})

const gridCols = computed(() => {
  if (props.compact) {
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  }
  return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
})

const shouldShowBrowseAllButton = computed(() => {
  return route.path !== '/mcp-server/add'
})

// Methods
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

const handleInstall = (server: McpServer) => {
  // Emit the server selection for parent components that need it
  emit('serverSelected', server)

  // Navigate to wizard step 2 with pre-selected server
  router.push({
    path: '/mcp-server/add',
    query: {
      serverId: server.id,
      step: '2'
    }
  })
}

const handleServerClick = (server: McpServer) => {
  router.push(`/mcp-server/view/${server.id}`)
}

const getServerLanguageBadge = (server: McpServer) => {
  return server.language || 'Unknown'
}

const getServerDescription = (server: McpServer) => {
  return server.description || 'No description available'
}

const getGitHubAvatarUrl = (server: McpServer) => {
  if (!server.github_account_id) return null
  return `https://avatars.githubusercontent.com/u/${server.github_account_id}?v=4&s=64`
}

// Lifecycle
onMounted(() => {
  fetchFeaturedServers()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div v-if="showTitle" class="text-center">
      <h3 class="text-lg font-semibold text-gray-900">
        {{ displayTitle }}
      </h3>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Loader2 class="h-6 w-6 animate-spin mr-2 text-gray-400" />
      <span class="text-gray-600">{{ t('mcpInstallations.featured.loading') }}</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-8">
      <div class="rounded-md bg-red-50 p-4">
        <p class="text-sm text-red-700">{{ error }}</p>
        <Button
          variant="outline"
          size="sm"
          @click="fetchFeaturedServers"
          class="mt-2"
        >
          {{ t('actions.retry') }}
        </Button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="featuredServers.length === 0" class="text-center py-8">
      <p class="text-gray-500">{{ t('mcpInstallations.featured.noServers') }}</p>
    </div>

    <!-- Featured Servers Grid -->
    <div v-else :class="`grid ${gridCols} gap-8`">
      <div
        v-for="server in featuredServers"
        :key="server.id"
      >
        <h2 class="sr-only">Server Details</h2>
        <div class="rounded-lg bg-gray-50 shadow-xs outline-1 outline-gray-900/5">
          <dl class="flex flex-wrap">
            <div class="flex-auto pt-6 pl-6">
              <dt 
                class="text-sm/6 font-semibold text-gray-900 cursor-pointer hover:text-teal-700 transition-colors flex items-center gap-2"
                @click="handleServerClick(server)"
                :title="`View ${server.name} details`"
              >
                <img 
                  v-if="getGitHubAvatarUrl(server)"
                  :src="getGitHubAvatarUrl(server)!"
                  :alt="`${server.name} GitHub avatar`"
                  class="h-8 w-8 rounded-md flex-shrink-0"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                />
                {{ server.name }}
              </dt>
            </div>
            <div class="mt-6 flex w-full flex-none gap-x-4 items-center border-t border-gray-900/5 px-6 pt-6">
              <dt class="flex-none">
                <span class="sr-only">{{ t('mcpInstallations.view.fields.repository') }}</span>
                <Github class="h-4 w-4 text-gray-400" aria-hidden="true" />
              </dt>
              <dd class="text-sm/6 font-medium text-gray-900 min-w-0 flex-1">
                <a
                  v-if="server.github_url"
                  :href="server.github_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:underline truncate block"
                  :title="server.github_url.replace('https://github.com/', '')"
                >
                  {{ server.github_url.replace('https://github.com/', '') }}
                </a>
                <span v-else class="text-gray-500 truncate block">{{ t('mcpInstallations.view.values.notProvided') }}</span>
              </dd>
            </div>
            <div class="mt-4 flex w-full flex-none gap-x-4 items-center px-6">
              <dt class="flex-none">
                <span class="sr-only">{{ t('mcpInstallations.view.fields.technical') }}</span>
                <Code class="h-4 w-4 text-gray-400" aria-hidden="true" />
              </dt>
              <dd class="text-sm/6 text-gray-500">
                {{ getServerLanguageBadge(server) }}
              </dd>
            </div>
            <div class="mt-4 flex w-full flex-none gap-x-4 px-6">
              <dd class="text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">{{ getServerDescription(server) }}</dd>
            </div>
          </dl>
          <div class="mt-6 border-t border-gray-900/5 px-6 py-6">
            <Button
              @click="handleInstall(server)"
              variant="outline"
              class="w-full flex items-center justify-center gap-2 bg-black text-white border-black hover:bg-black/90 hover:border-black hover:text-white text-sm font-semibold"
            >
              {{ t('mcpInstallations.actions.install') }} <span aria-hidden="true">&rarr;</span>
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Show More Link -->
    <div v-if="featuredServers.length > 0 && shouldShowBrowseAllButton" class="text-center">
      <Button
        variant="ghost"
        size="sm"
        @click="router.push('/mcp-server/add')"
        class="text-sm text-gray-600 hover:text-gray-900"
      >
        Browse all servers →
      </Button>
    </div>
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
