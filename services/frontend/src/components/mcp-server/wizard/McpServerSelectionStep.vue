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
      <span class="text-gray-600">{{ t('messages.loading') }}</span>
    </div>

    <!-- Server List (only show when there's a search query) -->
    <div v-else-if="searchQuery.trim() && filteredServers.length > 0" class="space-y-4">
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
    <div v-else-if="searchQuery.trim() && filteredServers.length === 0" class="text-center py-8">
      <p class="text-gray-500">{{ t('mcpInstallations.wizard.server.noServersFound') }}</p>
    </div>

    <!-- Empty State (when no search performed) -->
    <div v-else-if="!searchQuery.trim() && !isLoading" class="text-center py-8">
      <p class="text-gray-500">Enter a search term and click Search to find MCP servers...</p>
    </div>
  </div>
</template>
