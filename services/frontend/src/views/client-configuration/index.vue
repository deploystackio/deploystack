<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { GatewayConfigService, type ClientConfigResponse, type LinkAction, type TextAction, type CommandAction, type StepsAction, type ClientInfo, type ClientCategory } from '@/services/satelliteConfigService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ExternalLink } from 'lucide-vue-next'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// State
const clientCategories = ref<ClientCategory[]>([])
const supportedClients = ref<ClientInfo[]>([])
const selectedClient = ref<string>('')
const selectedCategory = ref<string>('')
const configContent = ref('')
const configDescription = ref<string>('')
const configInputType = ref<'input' | 'textarea'>('textarea')
const linkActions = ref<LinkAction[]>([])
const textActions = ref<TextAction[]>([])
const commandActions = ref<CommandAction[]>([])
const stepsActions = ref<StepsAction[]>([])
const contentType = ref<'json' | 'text' | 'command' | 'steps' | 'empty'>('empty')
const isLoading = ref(true)
const isLoadingConfig = ref(false)
const error = ref<string | null>(null)
const isCopying = ref(false)

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

    configContent.value = GatewayConfigService.getFormattedContent(response)
    linkActions.value = GatewayConfigService.getLinkActions(response)
    textActions.value = GatewayConfigService.getTextActions(response)
    commandActions.value = GatewayConfigService.getCommandActions(response)
    stepsActions.value = GatewayConfigService.getStepsActions(response)

    // Extract description and inputType from the first action in the response
    const firstAction = response[0]
    configDescription.value = firstAction?.description || t('clientConfiguration.description')

    // Extract inputType from the action (if it has one)
    if (firstAction && 'inputType' in firstAction && firstAction.inputType) {
      configInputType.value = firstAction.inputType
    } else {
      configInputType.value = 'textarea' // default to textarea
    }

    if (stepsActions.value.length > 0) {
      contentType.value = 'steps'
    } else if (commandActions.value.length > 0) {
      contentType.value = 'command'
    } else if (textActions.value.length > 0) {
      contentType.value = 'text'
    } else if (GatewayConfigService.getJsonConfig(response)) {
      contentType.value = 'json'
    } else {
      contentType.value = 'empty'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load configuration'
    toast.error(errorMessage)
    configContent.value = `Error: ${errorMessage}`
    configDescription.value = ''
    configInputType.value = 'textarea'
    linkActions.value = []
    textActions.value = []
    commandActions.value = []
    stepsActions.value = []
    contentType.value = 'empty'
  } finally {
    isLoadingConfig.value = false
  }
}

// Copy to clipboard
async function handleCopy() {
  if (!configContent.value.trim()) {
    toast.error('No configuration to copy')
    return
  }

  isCopying.value = true

  try {
    await navigator.clipboard.writeText(configContent.value)
    let messageKey = 'satelliteConfig.messages.copySuccess'
    if (contentType.value === 'text') {
      messageKey = 'satelliteConfig.messages.copyInstructionsSuccess'
    } else if (contentType.value === 'command') {
      messageKey = 'satelliteConfig.messages.copyCommandSuccess'
    }
    toast.success(t(messageKey))
  } catch {
    toast.error('Failed to copy configuration to clipboard')
  } finally {
    isCopying.value = false
  }
}

// Handle install button click
function handleInstallClick(action: LinkAction) {
  if (action.url.startsWith('cursor://')) {
    window.location.href = action.url
  } else {
    window.open(action.url, '_blank')
  }

  toast.success(action.name || 'Installation link opened')
}

// Get appropriate label for the configuration content
function getConfigLabel(): string {
  if (contentType.value === 'command') {
    return t('satelliteConfig.modal.commandLabel')
  }
  if (contentType.value === 'text') {
    return t('satelliteConfig.modal.instructionsLabel')
  }
  return t('satelliteConfig.modal.configLabel')
}

// Get copy button text
function getCopyButtonText(): string {
  return t('satelliteConfig.button.copy')
}

// Get CSS classes for textarea based on content type
function getTextareaClasses(): string {
  const baseClasses = 'min-h-[200px]'
  if (contentType.value === 'text') {
    return `min-h-[400px] font-sans text-sm leading-relaxed`
  }
  if (contentType.value === 'command') {
    return `${baseClasses} font-mono text-sm bg-gray-50 dark:bg-gray-900`
  }
  return `${baseClasses} font-mono text-sm`
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
              <CardTitle class="text-xl">
                {{ getClientDisplayName(selectedClient) }}
              </CardTitle>
              <CardDescription>
                {{ configDescription || t('clientConfiguration.description') }}
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
              <!-- One-Click Install Buttons with Image -->
              <div v-if="linkActions.length > 0" class="space-y-3">
                <div v-for="action in linkActions" :key="action.url">
                  <!-- Show image if imageUrl exists -->
                  <a
                    v-if="action.imageUrl"
                    :href="action.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-block"
                  >
                    <img
                      :src="action.imageUrl"
                      :alt="action.buttonText || action.name || 'Install'"
                      class="h-8 cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </a>
                  <!-- Show button if no imageUrl -->
                  <Button
                    v-else
                    @click="handleInstallClick(action)"
                    variant="outline"
                    class="flex items-center gap-2"
                  >
                    <ExternalLink class="h-4 w-4" />
                    {{ action.buttonText || action.name || 'Install' }}
                  </Button>
                </div>
              </div>

              <!-- Steps Instructions -->
              <div v-if="stepsActions.length > 0" class="space-y-4">
                <div v-for="(stepsAction, actionIndex) in stepsActions" :key="actionIndex">
                  <ol class="space-y-3 list-none">
                    <li v-for="(step, index) in stepsAction.steps" :key="index" class="flex gap-3">
                      <span class="shrink-0 font-semibold text-sm">{{ index + 1 }}.</span>
                      <div class="flex-1 space-y-1">
                        <div class="font-medium text-sm">{{ step.name }}</div>
                        <div class="text-sm text-muted-foreground">{{ step.content }}</div>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>

              <!-- Configuration Content (only show if not a link-only action) -->
              <div v-if="configContent.trim()" class="space-y-2">
                <label class="text-sm font-medium">{{ getConfigLabel() }}</label>
                <Input
                  v-if="configInputType === 'input'"
                  v-model="configContent"
                  :placeholder="isLoadingConfig ? t('satelliteConfig.modal.loading') : t('satelliteConfig.modal.configPlaceholder')"
                  :disabled="isLoadingConfig"
                  class="font-mono text-sm"
                  readonly
                />
                <Textarea
                  v-else
                  v-model="configContent"
                  :placeholder="isLoadingConfig ? t('satelliteConfig.modal.loading') :
                    (contentType === 'text' ? t('satelliteConfig.modal.instructionsPlaceholder') : t('satelliteConfig.modal.configPlaceholder'))"
                  :disabled="isLoadingConfig"
                  :class="getTextareaClasses()"
                  readonly
                />
              </div>

              <!-- Copy Button (only show if there's content to copy) -->
              <div v-if="configContent.trim()" class="flex justify-end">
                <Button
                  @click="handleCopy"
                  :loading="isCopying"
                  loading-text="Copying..."
                  :disabled="!configContent.trim() || isLoadingConfig"
                >
                  {{ getCopyButtonText() }}
                </Button>
              </div>
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
