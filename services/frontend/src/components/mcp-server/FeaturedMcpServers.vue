<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'
import McpServerSquareCard from './McpServerSquareCard.vue'

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
  return route.path !== '/mcp-server/install'
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
  emit('serverSelected', server)
}

const handleServerClick = () => {
  // The card component handles navigation internally
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
      <McpServerSquareCard
        v-for="server in featuredServers"
        :key="server.id"
        :server="server"
        @install="handleInstall"
        @click="handleServerClick"
      />
    </div>

    <!-- Show More Link -->
    <div v-if="featuredServers.length > 0 && shouldShowBrowseAllButton" class="text-center">
      <Button
        variant="ghost"
        size="sm"
        @click="router.push('/mcp-server/install')"
        class="text-sm text-gray-600 hover:text-gray-900"
      >
        Browse all servers →
      </Button>
    </div>
  </div>
</template>
