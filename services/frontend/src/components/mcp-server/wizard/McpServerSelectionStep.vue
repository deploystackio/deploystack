<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Loader2, ChevronDown, PackagePlus, AlertTriangle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import McpServerCard from '@/components/mcp-server/McpServerCard.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { McpCategoriesService } from '@/services/mcpCategoriesService'
import type { McpServerSearchParams, McpServerSearchResponse } from '@/types/mcp-catalog'

// Props and emits
const modelValue = defineModel<string>({ required: true })

const emit = defineEmits<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serverSelected: [serverData: any]
  nextStep: []
}>()

const { t } = useI18n()
const router = useRouter()

// State
const isLoading = ref(false)
const isLoadingCategories = ref(false)
const error = ref<string | null>(null)
const categoriesError = ref<string | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const categories = ref<any[]>([])
const searchTerm = ref('')
const searchQuery = ref('')
const selectedServerId = ref<string | null>(null)
const selectedCategory = ref('all')
const searchResults = ref<McpServerSearchResponse | null>(null)

// Constants
const MAX_RESULTS_TO_SHOW = 50

// Computed
const filteredServers = computed(() => {
  return searchResults.value?.servers || []
})

const showTooManyResultsWarning = computed(() => {
  const pagination = searchResults.value?.pagination
  return pagination && pagination.total > MAX_RESULTS_TO_SHOW
})

const shouldShowResults = computed(() => {
  const pagination = searchResults.value?.pagination
  return pagination && pagination.total <= MAX_RESULTS_TO_SHOW && filteredServers.value.length > 0
})

const hasSearched = computed(() => {
  return searchQuery.value.trim().length > 0
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleInstallClick = (server: any) => {
  selectedServerId.value = server.id
  modelValue.value = server.id

  // Emit server data to parent
  emit('serverSelected', server)

  // Automatically advance to next step
  emit('nextStep')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleDetailsClick = (server: any) => {
  router.push(`/mcp-server/view/${server.id}`)
}

const performSearch = async () => {
  if (!searchTerm.value.trim()) {
    return
  }

  try {
    isLoading.value = true
    error.value = null
    searchQuery.value = searchTerm.value

    const searchParams: McpServerSearchParams = {
      q: searchTerm.value.trim(),
      limit: MAX_RESULTS_TO_SHOW + 1, // Get one extra to detect if there are more
      offset: 0
    }

    // Add category filter if selected
    if (selectedCategory.value !== 'all') {
      searchParams.category = selectedCategory.value
    }

    const response = await McpCatalogService.searchServers(searchParams)

    // Check if we got too many results
    if (response.pagination.total > MAX_RESULTS_TO_SHOW) {
      searchResults.value = {
        servers: [],
        pagination: response.pagination,
        filters: response.filters
      }
    } else {
      searchResults.value = response
    }

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to search servers'
    searchResults.value = null
  } finally {
    isLoading.value = false
  }
}

const clearSearch = () => {
  searchTerm.value = ''
  searchQuery.value = ''
  searchResults.value = null
  error.value = null
}

onMounted(() => {
  loadCategories()
})

</script>

<template>
  <div class="pt-10">
    <div class="mx-auto max-w-2xl">
      <div class="text-center">
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
    <div v-if="isLoading" class="mt-14 flex items-center justify-center py-8">
      <Loader2 class="h-6 w-6 animate-spin mr-2 text-gray-400" />
      <span class="text-gray-600">{{ t('messages.loading') }}</span>
    </div>

    <!-- Too Many Results Warning -->
    <div v-else-if="showTooManyResultsWarning" class="mt-14">
      <Alert class="border-orange-200 bg-orange-50 text-orange-800">
        <AlertTriangle class="h-4 w-4" />
        <AlertDescription>
          {{ t('mcpInstallations.wizard.server.tooManyResults', { total: searchResults?.pagination.total }) }}
        </AlertDescription>
      </Alert>
      <div class="mt-4 text-center">
        <Button variant="outline" @click="clearSearch">
          {{ t('actions.clearSearch') }}
        </Button>
      </div>
    </div>

    <!-- Server List (only show when there's a search query and results fit criteria) -->
    <div v-else-if="shouldShowResults" class="mt-14 space-y-4">
      <!-- Results info -->
      <div v-if="searchResults?.pagination" class="text-sm text-gray-600 text-center">
        {{ t('mcpInstallations.wizard.server.maxResultsReached', {
          shown: filteredServers.length,
          total: searchResults.pagination.total
        }) }}
      </div>

      <McpServerCard
        v-for="server in filteredServers"
        :key="server.id"
        :server="server"
        :selected-server-id="selectedServerId"
        @install="handleInstallClick"
        @details="handleDetailsClick"
      />
    </div>

    <!-- No Results -->
    <div v-else-if="hasSearched && filteredServers.length === 0 && !showTooManyResultsWarning && !isLoading" class="mt-14 text-center py-8">
      <p class="text-gray-500">{{ t('mcpInstallations.wizard.server.noServersFound') }}</p>
      <div class="mt-4">
        <Button variant="outline" @click="clearSearch">
          {{ t('actions.clearSearch') }}
        </Button>
      </div>
    </div>

    <!-- Empty State (when no search performed) -->
    <div v-else-if="!hasSearched && !isLoading" class="mt-14 text-center py-8">
      <p class="text-gray-500">{{ t('mcpInstallations.wizard.server.emptyStateMessage') }}</p>
    </div>
  </div>
</template>
