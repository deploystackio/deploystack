<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ChevronDown, PackagePlus, AlertTriangle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useTeamContext } from '@/composables/useTeamContext'
import NavbarLayout from '@/components/NavbarLayout.vue'
import McpServerSquareCard from '@/components/mcp-server/McpServerSquareCard.vue'
import FeaturedMcpServers from '@/components/mcp-server/FeaturedMcpServers.vue'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { McpCategoriesService } from '@/services/mcpCategoriesService'
import type { McpServerSearchParams, McpServerSearchResponse } from '@/types/mcp-catalog'

const { t } = useI18n()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

// Team context using composable
const { selectedTeam } = useTeamContext()

// State
const isLoading = ref(false)
const isLoadingCategories = ref(false)
const error = ref<string | null>(null)
const categoriesError = ref<string | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const categories = ref<any[]>([])
const searchTerm = ref('')
const searchQuery = ref('')
const selectedCategory = ref('all')
const searchResults = ref<McpServerSearchResponse | null>(null)

// Pagination state
const currentPage = ref(1)
const pageSize = ref(15)
const totalItems = ref(0)
const pageSizeOptions = ref([15, 30, 45, 60])

// Computed
const filteredServers = computed(() => {
  return searchResults.value?.servers || []
})

const hasSearched = computed(() => {
  return searchQuery.value.trim().length > 0
})

const shouldShowResults = computed(() => {
  return hasSearched.value && filteredServers.value.length > 0
})

// Show Deploy MCP button only if team allows GitHub MCP
const showDeployButton = computed(() => {
  return selectedTeam.value?.allow_github_mcp === true
})

// Methods
const loadCategories = async () => {
  try {
    isLoadingCategories.value = true
    categoriesError.value = null

    const categoryList = await McpCategoriesService.getCategories()
    categories.value = categoryList
  } catch (err) {
    categoriesError.value = err instanceof Error ? err.message : t('mcpInstallations.wizard.server.categoriesError')
    categories.value = []
  } finally {
    isLoadingCategories.value = false
  }
}

const performSearch = async () => {
  if (!searchTerm.value.trim()) {
    return
  }

  try {
    isLoading.value = true
    error.value = null
    searchQuery.value = searchTerm.value

    const offset = (currentPage.value - 1) * pageSize.value

    const searchParams: McpServerSearchParams = {
      q: searchTerm.value.trim(),
      sort_by: 'github_stars',
      limit: pageSize.value,
      offset: offset
    }

    // Add category filter if selected
    if (selectedCategory.value !== 'all') {
      searchParams.category = selectedCategory.value
    }

    const response = await McpCatalogService.searchServers(searchParams)
    searchResults.value = response
    totalItems.value = response.pagination.total

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to search servers'
    searchResults.value = null
    totalItems.value = 0
  } finally {
    isLoading.value = false
  }
}

const clearSearch = () => {
  searchTerm.value = ''
  searchQuery.value = ''
  searchResults.value = null
  error.value = null
  currentPage.value = 1
  totalItems.value = 0
}

// Pagination event handlers
const handlePageChange = async (page: number) => {
  currentPage.value = page
  await performSearch()
}

const handlePageSizeChange = async (newPageSize: number) => {
  pageSize.value = newPageSize
  currentPage.value = 1
  await performSearch()
}

onMounted(() => {
  setBreadcrumbs([
    { label: t('mcpInstallations.title'), href: '/mcp-server' },
    { label: t('mcpInstallations.wizard.server.title') }
  ])
  loadCategories()
})
</script>

<template>
  <NavbarLayout>
    <div :class="shouldShowResults ? 'pt-2' : 'pt-10'">
      <div class="mx-auto max-w-2xl">
        <!-- Header - hide when we have search results -->
        <div v-if="!shouldShowResults" class="text-center">
          <div class="mx-auto size-16 text-gray-400">
            <PackagePlus class="w-full h-full" stroke-width="1.25" aria-hidden="true" />
          </div>
          <h2 class="mt-2 text-base font-semibold text-gray-900">
            {{ t('mcpInstallations.wizard.server.title') }}
          </h2>
          <p class="mt-1 text-sm text-gray-500">
            {{ t('mcpInstallations.wizard.server.description') }}
          </p>
        </div>

        <!-- Search Form -->
        <form class="mt-6 sm:flex sm:items-center" @submit.prevent="performSearch">
          <div class="flex grow items-center rounded-md bg-white pl-3 outline-1 -outline-offset-1 outline-gray-300 has-[input:focus-within]:outline-2 has-[input:focus-within]:-outline-offset-2 has-[input:focus-within]:outline-primary">
            <input
              v-model="searchTerm"
              type="text"
              name="search"
              :aria-label="t('mcpInstallations.wizard.server.searchLabel')"
              class="block min-w-0 grow py-1.5 pr-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none sm:text-sm/6"
              :placeholder="t('mcpInstallations.wizard.server.searchPlaceholder')"
            />
            <div class="grid shrink-0 grid-cols-1 focus-within:relative">
              <select
                v-model="selectedCategory"
                name="category"
                :aria-label="t('mcpInstallations.wizard.server.categoryLabel')"
                class="col-start-1 row-start-1 w-full appearance-none rounded-md py-1.5 pr-7 pl-3 text-base text-gray-500 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
                :disabled="isLoadingCategories"
              >
                <option value="all">
                  {{ t('mcpInstallations.wizard.server.allCategories') }}
                </option>
                <option
                  v-for="category in categories"
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.name }}
                </option>
              </select>
              <ChevronDown class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4" aria-hidden="true" />
            </div>
          </div>
          <div class="mt-3 sm:mt-0 sm:ml-4 sm:shrink-0">
            <button
              type="submit"
              class="block w-full rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :disabled="isLoading || !searchTerm.trim()"
            >
              {{ isLoading ? t('mcpInstallations.wizard.server.searching') : t('mcpInstallations.wizard.server.searchButton') }}
            </button>
          </div>
        </form>

        <!-- Browse Buttons -->
        <div class="mt-4 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            class="bg-black text-white border-black hover:bg-black/90 hover:border-black hover:text-white"
            @click="router.push('/mcp-server/featured')"
          >
            {{ t('mcpInstallations.wizard.server.browseFeatured') }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="bg-black text-white border-black hover:bg-black/90 hover:border-black hover:text-white"
            @click="router.push('/mcp-server/catalog')"
          >
            {{ t('mcpInstallations.wizard.server.viewAllServers') }}
          </Button>
          <Button
            v-if="showDeployButton"
            variant="outline"
            size="sm"
            class="bg-black text-white border-black hover:bg-black/90 hover:border-black hover:text-white"
            @click="router.push('/deploy')"
          >
            {{ t('mcpInstallations.actions.deployMcp') }}
          </Button>
        </div>
      </div>

      <div v-if="isLoadingCategories" class="mt-4 text-center text-sm text-gray-500">
        {{ t('mcpInstallations.wizard.server.loadingCategories') }}
      </div>

      <Alert v-if="categoriesError" class="mt-4 border-yellow-200 bg-yellow-50 text-yellow-800">
        <AlertTriangle class="h-4 w-4" />
        <AlertDescription>{{ categoriesError }}</AlertDescription>
      </Alert>

      <!-- Error Alert -->
      <div v-if="error" class="mt-14 rounded-md bg-red-50 p-4">
        <div class="flex">
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">
              {{ t('mcpInstallations.wizard.server.errorTitle') }}
            </h3>
            <div class="mt-2 text-sm text-red-700">
              <p>{{ error }}</p>
            </div>
            <div class="mt-4">
              <div class="-mx-2 -my-1.5 flex">
                <button
                  type="button"
                  @click="performSearch"
                  class="rounded-md bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                >
                  {{ t('actions.retry') }}
                </button>
                <button
                  type="button"
                  @click="clearSearch"
                  class="ml-3 rounded-md bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                >
                  {{ t('actions.clear') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="mt-14 space-y-6">
        <!-- Skeleton grid with 6 cards (2 rows x 3 columns) -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div v-for="i in 6" :key="i" class="rounded-lg bg-gray-50 border-[6px] border-gray-200 p-6">
            <div class="space-y-4">
              <!-- Header with avatar and title -->
              <div class="flex items-center gap-2">
                <Skeleton class="h-8 w-8 rounded-md" />
                <Skeleton class="h-5 w-32" />
              </div>
              <!-- GitHub repo line -->
              <div class="flex items-center gap-2 pt-4 border-t border-gray-900/5">
                <Skeleton class="h-4 w-4 rounded" />
                <Skeleton class="h-4 flex-1" />
              </div>
              <!-- Description -->
              <div class="space-y-2">
                <Skeleton class="h-4 w-full" />
                <Skeleton class="h-4 w-full" />
                <Skeleton class="h-4 w-3/4" />
              </div>
              <!-- Tags area -->
              <div class="flex gap-1.5 flex-wrap min-h-[3rem]">
                <Skeleton class="h-6 w-16 rounded-md" />
                <Skeleton class="h-6 w-20 rounded-md" />
                <Skeleton class="h-6 w-14 rounded-md" />
              </div>
              <!-- Install button -->
              <div class="pt-4 border-t border-gray-900/5">
                <Skeleton class="h-10 w-full rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Server Grid (only show when there's a search query and results) -->
      <div v-else-if="shouldShowResults" class="mt-14 space-y-6">
        <!-- 3-tier grid layout -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <McpServerSquareCard
            v-for="server in filteredServers"
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
          :is-loading="isLoading"
          :page-size-options="pageSizeOptions"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        />
      </div>

      <!-- No Results -->
      <div v-else-if="hasSearched && filteredServers.length === 0 && !isLoading" class="mt-14 text-center py-8">
        <p class="text-gray-500">{{ t('mcpInstallations.wizard.server.noServersFound') }}</p>
        <div class="mt-4">
          <Button variant="outline" @click="clearSearch">
            {{ t('actions.clearSearch') }}
          </Button>
        </div>
      </div>

      <!-- Empty State (when no search performed) -->
      <div v-else-if="!hasSearched && !isLoading" class="mt-14 space-y-8">
        <div class="text-center py-8">
          <p class="text-gray-500">{{ t('mcpInstallations.wizard.server.emptyStateMessage') }}</p>
        </div>

        <!-- Featured MCP Servers -->
        <div class="max-w-7xl">
          <FeaturedMcpServers :compact="true" />
        </div>
      </div>
    </div>
  </NavbarLayout>
</template>
