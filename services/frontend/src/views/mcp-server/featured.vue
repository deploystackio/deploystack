<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { toast } from 'vue-sonner'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { McpCatalogService, type FeaturedCategory } from '@/services/mcpCatalogService'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'
import McpServerSquareCard from '@/components/mcp-server/McpServerSquareCard.vue'
import DynamicIcon from '@/components/ui/dynamic-icon/DynamicIcon.vue'
import { Star } from 'lucide-vue-next'

const { t } = useI18n()
const { setBreadcrumbs } = useBreadcrumbs()

const categories = ref<FeaturedCategory[]>([])
const servers = ref<McpServer[]>([])
const isLoading = ref(true)
const isLoadingServers = ref(false)

interface ServersByCategory {
  id: string
  name: string
  icon: string | null
  slug: string
  servers: McpServer[]
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const serversByCategory = computed<ServersByCategory[]>(() => {
  const grouped = new Map<string, ServersByCategory>()

  for (const server of servers.value) {
    const categoryId = server.category?.id || 'uncategorized'
    const categoryName = server.category?.name || 'Uncategorized'
    const categoryIcon = server.category?.icon || null

    if (!grouped.has(categoryId)) {
      grouped.set(categoryId, {
        id: categoryId,
        name: categoryName,
        icon: categoryIcon,
        slug: toSlug(categoryName),
        servers: []
      })
    }
    grouped.get(categoryId)!.servers.push(server)
  }

  // Sort by category name
  return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name))
})

async function loadCategories() {
  try {
    categories.value = await McpCatalogService.getFeaturedCategories()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load categories'
    toast.error(errorMessage)
  }
}

async function loadServers() {
  isLoadingServers.value = true
  try {
    servers.value = await McpCatalogService.getGlobalServers({ featured: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load featured servers'
    toast.error(errorMessage)
  } finally {
    isLoadingServers.value = false
  }
}

onMounted(async () => {
  setBreadcrumbs([
    { label: t('mcpInstallations.title', 'MCP Server Installations'), href: '/mcp-server' },
    { label: t('mcpInstallations.featured.title', 'Featured Catalog') }
  ])

  isLoading.value = true
  await Promise.all([loadCategories(), loadServers()])
  isLoading.value = false
})
</script>

<template>
  <NavbarLayout>
    <div class="space-y-6 pb-16">
      <div class="flex flex-col space-y-8 md:flex-row md:space-x-12 md:space-y-0 md:min-h-[calc(100vh-12rem)]">
        <!-- Desktop Sidebar -->
        <aside class="hidden md:block md:w-1/5 md:border-r md:pr-8">
          <div v-if="isLoading" class="text-muted-foreground text-sm">
            {{ t('common.common.loading') }}
          </div>
          <nav v-else class="space-y-6">
            <div class="space-y-1">
              <a
                v-for="category in categories"
                :key="category.id"
                :href="`#${toSlug(category.name)}`"
                class="flex items-center justify-between py-2 px-3 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-2">
                  <DynamicIcon
                    :name="category.icon"
                    class="h-5 w-5"
                  />
                  <span>{{ category.name }}</span>
                </div>
                <Badge variant="secondary" class="text-xs">
                  {{ category.featured_server_count }}
                </Badge>
              </a>
              <div v-if="categories.length === 0" class="text-sm text-muted-foreground py-2">
                {{ t('mcpInstallations.featured.noCategories', 'No categories found') }}
              </div>
            </div>
          </nav>
        </aside>

        <!-- Content Area -->
        <div class="flex-1">
          <div v-if="isLoading" class="text-muted-foreground">
            {{ t('common.common.loading') }}
          </div>

          <div v-else class="space-y-6">
            <!-- Loading State for Servers -->
            <div v-if="isLoadingServers" class="text-center py-8 text-muted-foreground">
              {{ t('common.common.loading') }}
            </div>

            <!-- Server Grid Grouped by Category -->
            <div v-else-if="servers.length > 0" class="space-y-10">
              <div v-for="group in serversByCategory" :key="group.id" :id="group.slug">
                <div class="flex items-center gap-2 mb-4">
                  <DynamicIcon :name="group.icon" class="h-4 w-4 text-muted-foreground" />
                  <h2 class="text-md">{{ group.name }}</h2>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <McpServerSquareCard
                    v-for="server in group.servers"
                    :key="server.id"
                    :server="server"
                  />
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <Empty v-else class="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Star />
                </EmptyMedia>
                <EmptyTitle>{{ t('mcpInstallations.featured.emptyState.title', 'No Featured Servers') }}</EmptyTitle>
                <EmptyDescription>
                  {{ t('mcpInstallations.featured.emptyState.description', 'Featured MCP servers need to be configured by an administrator.') }}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        </div>
      </div>
    </div>
  </NavbarLayout>
</template>
