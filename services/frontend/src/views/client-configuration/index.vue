<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { SidebarNav, type NavItem } from '@/components/ui/sidebar-nav'
import { GatewayConfigService, type ClientConfigResponse, type LinkAction, type TextAction, type CommandAction, type ClientInfo } from '@/services/satelliteConfigService'
import { Button } from '@/components/ui/button'
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
const supportedClients = ref<ClientInfo[]>([])
const selectedClient = ref<string>('')
const configContent = ref('')
const linkActions = ref<LinkAction[]>([])
const textActions = ref<TextAction[]>([])
const commandActions = ref<CommandAction[]>([])
const contentType = ref<'json' | 'text' | 'command' | 'empty'>('empty')
const isLoading = ref(true)
const isLoadingConfig = ref(false)
const error = ref<string | null>(null)
const isCopying = ref(false)

// Computed
const sidebarNavItems = computed((): NavItem[] => {
  return supportedClients.value
    .map(client => ({
      title: client.name,
      href: `/client-configuration/${client.id}`,
      iconPath: client.iconPath
    }))
    .sort((a, b) => a.title.localeCompare(b.title))
})

const selectedClientFromRoute = computed(() => {
  return route.params.client as string | undefined
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
    const clients = await GatewayConfigService.getSupportedClients()
    supportedClients.value = clients

    // If no client selected in route and we have clients, redirect to first one
    if (!selectedClientFromRoute.value && clients.length > 0) {
      const firstClient = clients[0]
      if (firstClient) {
        router.replace(`/client-configuration/${firstClient.id}`)
      }
    } else if (selectedClientFromRoute.value) {
      selectedClient.value = selectedClientFromRoute.value
      await loadConfiguration(selectedClientFromRoute.value)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load supported clients'
    toast.error(errorMessage)
  } finally {
    isLoading.value = false
  }
}

// Load configuration from API
async function loadConfiguration(client: string) {
  isLoadingConfig.value = true
  try {
    const response: ClientConfigResponse = await GatewayConfigService.getClientConfig(client)

    configContent.value = GatewayConfigService.getFormattedContent(response)
    linkActions.value = GatewayConfigService.getLinkActions(response)
    textActions.value = GatewayConfigService.getTextActions(response)
    commandActions.value = GatewayConfigService.getCommandActions(response)

    if (commandActions.value.length > 0) {
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
    linkActions.value = []
    textActions.value = []
    commandActions.value = []
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

// Get appropriate copy button text
function getCopyButtonText(): string {
  if (contentType.value === 'command') {
    return t('satelliteConfig.button.copyCommand')
  }
  if (contentType.value === 'text') {
    return t('satelliteConfig.button.copyInstructions')
  }
  return t('satelliteConfig.button.copy')
}

// Get CSS classes for textarea based on content type
function getTextareaClasses(): string {
  const baseClasses = 'min-h-[200px]'
  if (contentType.value === 'text') {
    return `${baseClasses} font-sans text-sm leading-relaxed`
  }
  if (contentType.value === 'command') {
    return `${baseClasses} font-mono text-sm bg-gray-50 dark:bg-gray-900`
  }
  return `${baseClasses} font-mono text-sm`
}

// Watch for route changes to load different client configurations
watch(selectedClientFromRoute, async (newClient) => {
  if (newClient && newClient !== selectedClient.value) {
    selectedClient.value = newClient
    await loadConfiguration(newClient)
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
          <SidebarNav v-if="!isLoading" :items="sidebarNavItems" />
          <div v-else class="text-muted-foreground text-sm">
            {{ t('common.common.loading') }}
          </div>
        </aside>

        <!-- Content Area -->
        <div class="flex-1 md:max-w-3xl">
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
                {{ t('clientConfiguration.description') }}
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
              <!-- One-Click Install Buttons -->
              <div v-if="linkActions.length > 0" class="space-y-3">
                <label class="text-sm font-medium">{{ t('satelliteConfig.modal.oneClickInstall') }}</label>
                <div class="flex flex-wrap gap-2">
                  <Button
                    v-for="action in linkActions"
                    :key="action.url"
                    @click="handleInstallClick(action)"
                    variant="outline"
                    class="flex items-center gap-2"
                  >
                    <ExternalLink class="h-4 w-4" />
                    {{ action.name || 'Install' }}
                  </Button>
                </div>
                <p class="text-sm text-muted-foreground">
                  {{ t('satelliteConfig.modal.oneClickDescription') }}
                </p>
              </div>

              <!-- Configuration Content -->
              <div class="space-y-2">
                <label class="text-sm font-medium">{{ getConfigLabel() }}</label>
                <Textarea
                  v-model="configContent"
                  :placeholder="isLoadingConfig ? t('satelliteConfig.modal.loading') :
                    (contentType === 'text' ? t('satelliteConfig.modal.instructionsPlaceholder') : t('satelliteConfig.modal.configPlaceholder'))"
                  :disabled="isLoadingConfig"
                  :class="getTextareaClasses()"
                  readonly
                />
              </div>

              <!-- Copy Button -->
              <div class="flex justify-end">
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
