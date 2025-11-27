<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { GatewayConfigService, type ClientConfigResponse, type ConfigAction, type ClientInfo, type ClientCategory } from '@/services/satelliteConfigService'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import LinkActionRenderer from '@/components/client-config/LinkActionRenderer.vue'
import StepsActionRenderer from '@/components/client-config/StepsActionRenderer.vue'
import CommandActionRenderer from '@/components/client-config/CommandActionRenderer.vue'
import JsonActionRenderer from '@/components/client-config/JsonActionRenderer.vue'
import TextActionRenderer from '@/components/client-config/TextActionRenderer.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// State
const clientCategories = ref<ClientCategory[]>([])
const supportedClients = ref<ClientInfo[]>([])
const selectedClient = ref<string>('')
const selectedCategory = ref<string>('')
const actions = ref<ConfigAction[]>([])
const isLoading = ref(true)
const isLoadingConfig = ref(false)
const error = ref<string | null>(null)

// Computed
const selectedClientFromRoute = computed(() => {
  return route.params.client as string | undefined
})

const selectedCategoryFromRoute = computed(() => {
  return route.params.category as string | undefined
})

// Get display name for client ID
function getClientDisplayName(clientId: string): string {
  const client = supportedClients.value.find(c => c.id === clientId)
  if (client) {
    return client.name
  }

  // Fallback: convert kebab-case to Title Case
  return clientId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

// Load supported clients
async function loadSupportedClients() {
  isLoading.value = true
  try {
    const categories = await GatewayConfigService.getClientCategoriesWithClients()

    // Sort clients alphabetically within each category
    const sortedCategories = categories.map(category => ({
      ...category,
      clients: [...category.clients].sort((a, b) => a.name.localeCompare(b.name))
    }))

    clientCategories.value = sortedCategories

    // Flatten to get all unique clients for lookups
    const allClients = new Map<string, ClientInfo>()
    for (const category of sortedCategories) {
      for (const client of category.clients) {
        allClients.set(client.id, client)
      }
    }
    supportedClients.value = Array.from(allClients.values())

    // If no route params and we have categories, redirect to first category and first client
    if (!selectedCategoryFromRoute.value && !selectedClientFromRoute.value && categories.length > 0) {
      const firstCategory = categories[0]
      const firstClient = firstCategory?.clients[0]
      if (firstCategory && firstClient) {
        router.replace(`/client-configuration/${firstCategory.id}/${firstClient.id}`)
      }
    } else if (selectedCategoryFromRoute.value && selectedClientFromRoute.value) {
      selectedCategory.value = selectedCategoryFromRoute.value
      selectedClient.value = selectedClientFromRoute.value
      await loadConfiguration(selectedCategoryFromRoute.value, selectedClientFromRoute.value)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load supported clients'
    toast.error(errorMessage)
  } finally {
    isLoading.value = false
  }
}

// Load configuration from API
async function loadConfiguration(category: string, client: string) {
  isLoadingConfig.value = true
  try {
    const response: ClientConfigResponse = await GatewayConfigService.getClientConfig(client, category)
    actions.value = response
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load configuration'
    toast.error(errorMessage)
    actions.value = []
  } finally {
    isLoadingConfig.value = false
  }
}

// Handle copy from action renderer components
async function handleCopy(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    toast.success(t('satelliteConfig.messages.copySuccess'))
  } catch {
    toast.error('Failed to copy to clipboard')
  }
}

// Handle link click from LinkActionRenderer
function handleLinkClick(action: { url: string; name?: string }) {
  if (action.url.startsWith('cursor://')) {
    window.location.href = action.url
  } else {
    window.open(action.url, '_blank')
  }
  toast.success(action.name || 'Installation link opened')
}

// Watch for route changes to load different client configurations
watch([selectedCategoryFromRoute, selectedClientFromRoute], async ([newCategory, newClient]) => {
  if (newCategory && newClient && (newCategory !== selectedCategory.value || newClient !== selectedClient.value)) {
    selectedCategory.value = newCategory
    selectedClient.value = newClient
    await loadConfiguration(newCategory, newClient)
  }
})

onMounted(async () => {
  await loadSupportedClients()
})
</script>

<template>
  <DashboardLayout :title="t('clientConfiguration.title')">
    <!-- Main Content -->
    <div class="space-y-6 pb-16">
      <div class="flex flex-col space-y-8 md:flex-row md:space-x-12 md:space-y-0">
        <!-- Desktop Sidebar Navigation -->
        <aside class="hidden md:block md:w-1/5">
          <div v-if="!isLoading" class="space-y-6">
            <div v-for="category in clientCategories" :key="category.id" class="space-y-2">
              <h3 class="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                {{ category.name }}
              </h3>
              <nav class="space-y-1">
                <RouterLink
                  v-for="client in category.clients"
                  :key="client.id"
                  :to="`/client-configuration/${category.id}/${client.id}`"
                  class="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors"
                  :class="[
                    selectedClient === client.id && selectedCategory === category.id
                      ? 'bg-secondary text-secondary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  ]"
                >
                  <img
                    v-if="client.iconPath"
                    :src="client.iconPath"
                    :alt="client.name"
                    class="w-5 h-5 object-contain"
                  />
                  <span>{{ client.name }}</span>
                </RouterLink>
              </nav>
            </div>
          </div>
          <div v-else class="text-muted-foreground text-sm">
            {{ t('common.common.loading') }}
          </div>
        </aside>

        <!-- Content Area -->
        <div class="flex-1">
          <div v-if="isLoading" class="text-muted-foreground">
            {{ t('common.common.loading') }}
          </div>
          <div v-else-if="error" class="text-red-500">
            {{ t('common.messages.error') }}: {{ error }}
          </div>

          <!-- Client Configuration Content -->
          <Card v-else-if="selectedClient">
            <CardHeader>
              <CardTitle>
                {{ getClientDisplayName(selectedClient) }}
              </CardTitle>
            </CardHeader>
            <CardContent class="space-y-6">
              <!-- Loading State -->
              <div v-if="isLoadingConfig" class="text-center py-8 text-muted-foreground">
                {{ t('satelliteConfig.modal.loading') }}
              </div>

              <!-- Actions Rendering -->
              <template v-else>
                <template v-for="(action, index) in actions" :key="index">
                  <!-- Link Actions (One-Click Install) -->
                  <div v-if="action.type === 'link'" class="space-y-2">
                    <label v-if="action.name" class="text-sm font-medium">{{ action.name }}</label>
                    <p v-if="action.description" class="text-sm text-muted-foreground">{{ action.description }}</p>
                    <LinkActionRenderer :action="action" @click="handleLinkClick" />
                  </div>

                  <!-- Steps Actions -->
                  <div v-else-if="action.type === 'steps'" class="space-y-2">
                    <label v-if="action.title" class="text-sm font-medium">{{ action.title }}</label>
                    <p v-if="action.description" class="text-sm text-muted-foreground">{{ action.description }}</p>
                    <StepsActionRenderer :action="action" />
                  </div>

                  <!-- Command Actions -->
                  <CommandActionRenderer
                    v-else-if="action.type === 'command'"
                    :action="action"
                    @copy="handleCopy"
                  />

                  <!-- JSON Actions -->
                  <JsonActionRenderer
                    v-else-if="action.type === 'json'"
                    :action="action"
                    @copy="handleCopy"
                  />

                  <!-- Text Actions (AI Instructions) -->
                  <TextActionRenderer
                    v-else-if="action.type === 'text'"
                    :action="action"
                    @copy="handleCopy"
                  />
                </template>
              </template>
            </CardContent>
          </Card>

          <div v-else-if="!selectedClientFromRoute && supportedClients.length === 0">
            <p class="text-muted-foreground">{{ t('satelliteConfig.messages.noClients') }}</p>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
