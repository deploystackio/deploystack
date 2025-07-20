<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Loader2, Info, Download, ChevronDown, PackagePlus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { McpCatalogService } from '@/services/mcpCatalogService'

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
const error = ref<string | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const servers = ref<any[]>([])
const searchTerm = ref('')
const searchQuery = ref('')
const selectedServerId = ref<string | null>(null)
const selectedCategory = ref('all')

// Available categories (you can expand this based on your data)
const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'development', label: 'Development' },
  { value: 'ai', label: 'AI & Machine Learning' },
  { value: 'database', label: 'Database' },
  { value: 'api', label: 'API & Integration' }
]

// Computed
const filteredServers = computed(() => {
  if (!searchQuery.value.trim()) return []

  const term = searchQuery.value.toLowerCase()
  let filtered = servers.value.filter(server =>
    server.name.toLowerCase().includes(term) ||
    server.description.toLowerCase().includes(term) ||
    server.author_name?.toLowerCase().includes(term) ||
    server.category_name?.toLowerCase().includes(term)
  )

  // Filter by category if not 'all'
  if (selectedCategory.value !== 'all') {
    filtered = filtered.filter(server => 
      server.category_name?.toLowerCase() === selectedCategory.value.toLowerCase()
    )
  }

  return filtered
})


// Methods
const loadServers = async () => {
  try {
    isLoading.value = true
    error.value = null

    const serverList = await McpCatalogService.getGlobalServers()
    servers.value = serverList
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load servers'
    servers.value = []
  } finally {
    isLoading.value = false
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

const performSearch = () => {
  searchQuery.value = searchTerm.value
}



// Lifecycle
onMounted(() => {
  loadServers()
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
            @keyup.enter="performSearch"
          />
          <div class="grid shrink-0 grid-cols-1 focus-within:relative">
            <select 
              v-model="selectedCategory"
              name="category" 
              :aria-label="t('mcpInstallations.wizard.server.categoryLabel')" 
              class="col-start-1 row-start-1 w-full appearance-none rounded-md py-1.5 pr-7 pl-3 text-base text-gray-500 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
            >
              <option 
                v-for="category in categories" 
                :key="category.value" 
                :value="category.value"
              >
                {{ category.label }}
              </option>
            </select>
            <ChevronDown class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4" aria-hidden="true" />
          </div>
        </div>
        <div class="mt-3 sm:mt-0 sm:ml-4 sm:shrink-0">
          <button 
            type="submit" 
            class="block w-full rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :disabled="isLoading"
          >
            {{ isLoading ? t('mcpInstallations.wizard.server.searching') : t('mcpInstallations.wizard.server.searchButton') }}
          </button>
        </div>
      </form>
    </div>

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
                @click="loadServers"
                class="rounded-md bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
              >
                {{ t('actions.retry') }}
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

    <!-- Server List (only show when there's a search query) -->
    <div v-else-if="searchQuery.trim() && filteredServers.length > 0" class="mt-14 space-y-4">
      <div
        v-for="server in filteredServers"
        :key="server.id"
        class="bg-gray-50 px-4 py-6 sm:rounded-lg sm:p-6 md:flex md:items-center md:justify-between md:space-x-6 lg:space-x-8"
      >
        <dl class="flex-auto divide-y divide-gray-200 text-sm text-gray-600 md:grid md:grid-cols-3 md:gap-x-6 md:divide-y-0 lg:w-1/2 lg:flex-none lg:gap-x-8">
          <div class="max-md:flex max-md:justify-between max-md:py-4 max-md:first:pt-0 max-md:last:pb-0">
            <dt class="font-medium text-gray-900">{{ t('mcpInstallations.wizard.server.name') }}</dt>
            <dd class="md:mt-1">{{ server.name }}</dd>
          </div>
          <div class="max-md:flex max-md:justify-between max-md:py-4 max-md:first:pt-0 max-md:last:pb-0">
            <dt class="font-medium text-gray-900">{{ t('mcpInstallations.wizard.server.author') }}</dt>
            <dd class="md:mt-1">{{ server.author_name || t('mcpInstallations.wizard.server.unknownAuthor') }}</dd>
          </div>
          <div class="max-md:flex max-md:justify-between max-md:py-4 max-md:first:pt-0 max-md:last:pb-0">
            <dt class="font-medium text-gray-900">{{ t('mcpInstallations.wizard.server.language') }}</dt>
            <dd class="md:mt-1">{{ server.language || t('mcpInstallations.wizard.server.unknownLanguage') }}</dd>
          </div>
        </dl>
        
        <!-- Description -->
        <div v-if="server.description" class="mt-4 md:mt-0 md:ml-6 lg:w-1/2">
          <p class="text-sm text-gray-600">{{ server.description }}</p>
        </div>
        
        <!-- Action Buttons -->
        <div class="mt-6 space-y-4 sm:flex sm:space-y-0 sm:space-x-4 md:mt-0">
          <Button
            variant="outline"
            @click="handleDetailsClick(server)"
            class="flex w-full items-center justify-center border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 md:w-auto"
          >
            <Info class="h-4 w-4 mr-2" />
            {{ t('mcpInstallations.wizard.server.details') }}
            <span class="sr-only">{{ server.name }}</span>
          </Button>
          <Button
            @click="handleInstallClick(server)"
            :variant="selectedServerId === server.id ? 'default' : 'outline'"
            :class="[
              'flex w-full items-center justify-center px-4 py-2 text-sm font-medium shadow-xs md:w-auto',
              selectedServerId === server.id
                ? 'border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            ]"
          >
            <Download class="h-4 w-4 mr-2" />
            {{ t('mcpInstallations.wizard.server.install') }}
            <span class="sr-only">{{ server.name }}</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- No Results -->
    <div v-else-if="searchQuery.trim() && filteredServers.length === 0" class="mt-14 text-center py-8">
      <p class="text-gray-500">{{ t('mcpInstallations.wizard.server.noServersFound') }}</p>
    </div>

    <!-- Empty State (when no search performed) -->
    <div v-else-if="!searchQuery.trim() && !isLoading" class="mt-14 text-center py-8">
      <p class="text-gray-500">{{ t('mcpInstallations.wizard.server.emptyStateMessage') }}</p>
    </div>
  </div>
</template>
