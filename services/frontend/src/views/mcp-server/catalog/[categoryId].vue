<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { toast } from 'vue-sonner'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { McpCategoriesService, type McpCategory } from '@/services/mcpCategoriesService'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'
import McpServerSquareCard from '@/components/mcp-server/McpServerSquareCard.vue'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import DynamicIcon from '@/components/ui/dynamic-icon/DynamicIcon.vue'
import { Package } from 'lucide-vue-next'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const categories = ref<McpCategory[]>([])
const servers = ref<McpServer[]>([])
const isLoadingCategories = ref(true)
const isLoadingServers = ref(false)

// Pagination state
const currentPage = ref(1)
const pageSize = ref(15)
const totalItems = ref(0)
const pageSizeOptions = [15, 30, 45, 60]

const currentCategoryId = computed(() => route.params.categoryId as string)

const currentCategory = computed(() => {
  return categories.value.find(cat => cat.id === currentCategoryId.value)
})

async function loadCategories() {
  isLoadingCategories.value = true
  try {
    categories.value = await McpCategoriesService.getCategories()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load categories'
    toast.error(errorMessage)
  } finally {
    isLoadingCategories.value = false
  }
}

async function loadServers() {
  if (!currentCategoryId.value) return

  isLoadingServers.value = true
  try {
    const response = await McpCatalogService.getGlobalServersPaginated(
      { category_id: currentCategoryId.value },
      { limit: pageSize.value, offset: (currentPage.value - 1) * pageSize.value }
    )
    servers.value = response.items
    totalItems.value = response.pagination.total
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load servers'
    toast.error(errorMessage)
    servers.value = []
    totalItems.value = 0
  } finally {
    isLoadingServers.value = false
  }
}

function navigateToCategory(categoryId: string) {
  router.push(`/mcp-server/catalog/${categoryId}`)
}

async function handlePageChange(page: number) {
  currentPage.value = page
  await loadServers()
}

async function handlePageSizeChange(newPageSize: number) {
  pageSize.value = newPageSize
  currentPage.value = 1
  await loadServers()
}

watch(currentCategoryId, () => {
  currentPage.value = 1
  loadServers()
})

onMounted(async () => {
  setBreadcrumbs([
    { label: t('mcpInstallations.title', 'MCP Server Installations'), href: '/mcp-server' },
    { label: t('mcpInstallations.catalog.title', 'Server Catalog') }
  ])

  await loadCategories()
  await loadServers()
})
</script>

<template>
  <DashboardLayout>
    <div class="space-y-6 pb-16">
      <div class="flex flex-col space-y-8 md:flex-row md:space-x-12 md:space-y-0 md:min-h-[calc(100vh-12rem)]">
        <!-- Desktop Sidebar -->
        <aside class="hidden md:block md:w-1/5 md:border-r md:pr-8">
          <div v-if="isLoadingCategories" class="space-y-2">
            <Skeleton v-for="i in 6" :key="i" class="h-10 w-full" />
          </div>
          <nav v-else class="space-y-6">
            <div class="space-y-1">
              <button
                v-for="category in categories"
                :key="category.id"
                type="button"
                class="w-full flex items-center justify-between py-2 px-3 rounded-md text-sm transition-colors cursor-pointer"
                :class="[
                  currentCategoryId === category.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                ]"
                @click="navigateToCategory(category.id)"
              >
                <div class="flex items-center gap-2">
                  <DynamicIcon
                    :name="category.icon"
                    class="h-5 w-5"
                  />
                  <span>{{ category.name }}</span>
                </div>
                <Badge variant="secondary" class="text-xs">
                  {{ category.server_count }}
                </Badge>
              </button>
              <div v-if="categories.length === 0" class="text-sm text-muted-foreground py-2">
                {{ t('mcpInstallations.catalog.noCategories', 'No categories found') }}
              </div>
            </div>
          </nav>
        </aside>

        <!-- Content Area -->
        <div class="flex-1">
          <!-- Category Header -->
          <div v-if="currentCategory" class="mb-4">
            <div class="flex items-center gap-2">
              <DynamicIcon :name="currentCategory.icon" class="h-4 w-4 text-muted-foreground" />
              <h2 class="text-md">{{ currentCategory.name }}</h2>
              <Badge variant="secondary" class="text-xs">{{ totalItems }}</Badge>
            </div>
            <p v-if="currentCategory.description" class="mt-1 text-sm text-muted-foreground">
              {{ currentCategory.description }}
            </p>
          </div>

          <!-- Loading State -->
          <div v-if="isLoadingServers" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div v-for="i in 6" :key="i" class="rounded-lg bg-gray-50 border-[6px] border-gray-200 p-6">
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <Skeleton class="h-8 w-8 rounded-md" />
                  <Skeleton class="h-5 w-32" />
                </div>
                <div class="flex items-center gap-2 pt-4 border-t border-gray-900/5">
                  <Skeleton class="h-4 w-4 rounded" />
                  <Skeleton class="h-4 flex-1" />
                </div>
                <div class="space-y-2">
                  <Skeleton class="h-4 w-full" />
                  <Skeleton class="h-4 w-full" />
                  <Skeleton class="h-4 w-3/4" />
                </div>
                <div class="flex gap-1.5 flex-wrap min-h-[3rem]">
                  <Skeleton class="h-6 w-16 rounded-md" />
                  <Skeleton class="h-6 w-20 rounded-md" />
                  <Skeleton class="h-6 w-14 rounded-md" />
                </div>
                <div class="pt-4 border-t border-gray-900/5">
                  <Skeleton class="h-10 w-full rounded-md" />
                </div>
              </div>
            </div>
          </div>

          <!-- Server Grid -->
          <div v-else-if="servers.length > 0" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <McpServerSquareCard
                v-for="server in servers"
                :key="server.id"
                :server="server"
              />
            </div>

            <!-- Pagination Controls -->
            <PaginationControls
              v-if="totalItems > 0"
              :current-page="currentPage"
              :page-size="pageSize"
              :total-items="totalItems"
              :is-loading="isLoadingServers"
              :page-size-options="pageSizeOptions"
              @page-change="handlePageChange"
              @page-size-change="handlePageSizeChange"
            />
          </div>

          <!-- Empty State -->
          <Empty v-else class="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package />
              </EmptyMedia>
              <EmptyTitle>{{ t('mcpInstallations.catalog.emptyState.title', 'No Servers in Category') }}</EmptyTitle>
              <EmptyDescription>
                {{ t('mcpInstallations.catalog.emptyState.description', 'This category does not have any MCP servers yet.') }}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
