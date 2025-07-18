<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Loader2, Info, Download } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { McpCatalogService } from '@/services/mcpCatalogService'

// Props and emits
const modelValue = defineModel<string>({ required: true })

const emit = defineEmits<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serverSelected: [serverData: any]
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

// Computed
const filteredServers = computed(() => {
  if (!searchQuery.value.trim()) return []

  const term = searchQuery.value.toLowerCase()
  return servers.value.filter(server =>
    server.name.toLowerCase().includes(term) ||
    server.description.toLowerCase().includes(term) ||
    server.author_name?.toLowerCase().includes(term) ||
    server.category_name?.toLowerCase().includes(term)
  )
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleDetailsClick = (server: any) => {
  router.push(`/mcp-server/view/${server.id}`)
}

const performSearch = () => {
  searchQuery.value = searchTerm.value
}

const getStatusClasses = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'text-green-700 bg-green-50 ring-green-600/20'
    case 'deprecated':
      return 'text-red-700 bg-red-50 ring-red-600/20'
    case 'beta':
      return 'text-yellow-800 bg-yellow-50 ring-yellow-600/20'
    default:
      return 'text-gray-600 bg-gray-50 ring-gray-500/10'
  }
}

// Lifecycle
onMounted(() => {
  loadServers()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Step Header -->
    <div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        {{ t('mcpInstallations.wizard.server.title') }}
      </h2>
      <p class="text-gray-600">
        {{ t('mcpInstallations.wizard.server.description') }}
      </p>
    </div>

    <!-- Search Input -->
    <div class="space-y-2">
      <label for="server-search" class="text-sm font-medium text-gray-700">
        {{ t('mcpInstallations.wizard.server.searchLabel') }}
      </label>
      <div class="flex w-full items-center gap-1.5">
        <Input
          id="server-search"
          v-model="searchTerm"
          type="text"
          :placeholder="t('mcpInstallations.wizard.server.searchPlaceholder')"
          @keyup.enter="performSearch"
          class="flex-1"
        />
        <Button type="button" @click="performSearch">
          Search
        </Button>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="rounded-md bg-red-50 p-4">
      <div class="flex">
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error loading servers</h3>
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
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Loader2 class="h-6 w-6 animate-spin mr-2 text-gray-400" />
      <span class="text-gray-600">{{ t('common.messages.loading') }}</span>
    </div>

    <!-- Server List (only show when there's a search query) -->
    <div v-else-if="searchQuery.trim() && filteredServers.length > 0">
      <ul role="list" class="divide-y divide-gray-100">
        <li
          v-for="server in filteredServers"
          :key="server.id"
          class="flex items-center justify-between gap-x-6 py-5"
        >
          <div class="min-w-0">
            <div class="flex items-start gap-x-3">
              <p class="text-sm/6 font-semibold text-gray-900">{{ server.name }}</p>
              <p :class="[getStatusClasses(server.status || 'Active'), 'mt-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset']">
                {{ server.status || 'Active' }}
              </p>
            </div>
            <div class="mt-1 flex items-center gap-x-2 text-xs/5 text-gray-500">
              <p class="truncate">{{ server.description }}</p>
              <svg v-if="server.author_name" viewBox="0 0 2 2" class="size-0.5 fill-current">
                <circle cx="1" cy="1" r="1" />
              </svg>
              <p v-if="server.author_name" class="whitespace-nowrap">{{ server.author_name }}</p>
              <svg v-if="server.language" viewBox="0 0 2 2" class="size-0.5 fill-current">
                <circle cx="1" cy="1" r="1" />
              </svg>
              <p v-if="server.language" class="whitespace-nowrap">{{ server.language }}</p>
            </div>
          </div>

          <!-- Button Group -->
          <div class="flex flex-none items-center gap-x-4">
            <span class="isolate inline-flex rounded-md shadow-xs">
              <button
                type="button"
                @click="handleDetailsClick(server)"
                class="relative inline-flex items-center gap-x-1.5 rounded-l-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 focus:z-10"
              >
                <Info class="-ml-0.5 size-4 text-gray-400" aria-hidden="true" />
                {{ t('mcpInstallations.wizard.server.details') }}
              </button>
              <button
                type="button"
                @click="handleInstallClick(server)"
                :class="[
                  'relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                  selectedServerId === server.id
                    ? 'bg-blue-600 text-white ring-blue-600 hover:bg-blue-700'
                    : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50'
                ]"
              >
                <Download class="-ml-0.5 size-4" :class="selectedServerId === server.id ? 'text-white' : 'text-gray-400'" aria-hidden="true" />
                {{ t('mcpInstallations.wizard.server.install') }}
              </button>
            </span>
          </div>
        </li>
      </ul>
    </div>

    <!-- No Results -->
    <div v-else-if="searchQuery.trim() && filteredServers.length === 0" class="text-center py-8">
      <p class="text-gray-500">{{ t('mcpInstallations.wizard.server.noServersFound') }}</p>
    </div>

    <!-- Empty State (when no search performed) -->
    <div v-else-if="!searchQuery.trim() && !isLoading" class="text-center py-8">
      <p class="text-gray-500">Enter a search term and click Search to find MCP servers...</p>
    </div>
  </div>
</template>
