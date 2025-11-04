<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { GatewayConfigService, type ClientConfigResponse, type LinkAction, type TextAction, type CommandAction } from '@/services/satelliteConfigService'
import { toast } from 'vue-sonner'
import { ExternalLink } from 'lucide-vue-next'

interface Props {
  open: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()

// State
const selectedClient = ref('')
const configContent = ref('')
const linkActions = ref<LinkAction[]>([])
const textActions = ref<TextAction[]>([])
const commandActions = ref<CommandAction[]>([])
const contentType = ref<'json' | 'text' | 'command' | 'empty'>('empty')
const isLoading = ref(false)
const isCopying = ref(false)
const supportedClients = ref<string[]>([])
const isLoadingClients = ref(false)

// Load supported clients when modal opens
watch(() => props.open, async (isOpen) => {
  if (isOpen && supportedClients.value.length === 0) {
    await loadSupportedClients()
  }
})

// Load configuration when client changes
watch(selectedClient, async (newClient) => {
  if (newClient) {
    await loadConfiguration(newClient)
  }
})

// Load supported clients from API
async function loadSupportedClients() {
  isLoadingClients.value = true
  try {
    const clients = await GatewayConfigService.getSupportedClients()
    supportedClients.value = clients
    // Set first client as default if no client is selected
    if (!selectedClient.value && clients.length > 0) {
      const firstClient = clients[0]
      if (firstClient) {
        selectedClient.value = firstClient
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load supported clients'
    toast.error(errorMessage)
  } finally {
    isLoadingClients.value = false
  }
}

// Load configuration from API
async function loadConfiguration(client: string) {
  isLoading.value = true
  try {
    const response: ClientConfigResponse = await GatewayConfigService.getClientConfig(client)

    // Extract formatted content for display (command, text, or JSON)
    configContent.value = GatewayConfigService.getFormattedContent(response)

    // Extract different action types
    linkActions.value = GatewayConfigService.getLinkActions(response)
    textActions.value = GatewayConfigService.getTextActions(response)
    commandActions.value = GatewayConfigService.getCommandActions(response)

    // Determine content type for UI styling
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
    isLoading.value = false
  }
}

// Get display name for client (with fallback)
function getClientDisplayName(client: string): string {
  // Convert client name to camelCase for i18n key matching
  const clientKey = client.split('-').map((word, index) => {
    if (index === 0) {
      return word.toLowerCase()
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }).join('')

  const translationKey = `satelliteConfig.clients.${clientKey}`
  const translated = t(translationKey)

  // If translation returns the key itself, it means translation doesn't exist
  // Fall back to a capitalized version of the client name
  if (translated === translationKey) {
    return client.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  return translated
}

function handleClose() {
  emit('update:open', false)
}

// Copy to clipboard and close
async function handleCopyAndClose() {
  if (!configContent.value.trim()) {
    toast.error('No configuration to copy')
    return
  }

  isCopying.value = true

  try {
    await navigator.clipboard.writeText(configContent.value)
    handleClose()
    // Show success toast after modal closes
    setTimeout(() => {
      let messageKey = 'satelliteConfig.messages.copySuccess'
      if (contentType.value === 'text') {
        messageKey = 'satelliteConfig.messages.copyInstructionsSuccess'
      } else if (contentType.value === 'command') {
        messageKey = 'satelliteConfig.messages.copyCommandSuccess'
      }
      toast.success(t(messageKey))
    }, 100)
  } catch {
    toast.error('Failed to copy configuration to clipboard')
  } finally {
    isCopying.value = false
  }
}

// Handle install button click
function handleInstallClick(action: LinkAction) {
  // For Cursor deeplinks, try to open directly
  if (action.url.startsWith('cursor://')) {
    window.location.href = action.url
  } else {
    // For other links, open in new tab
    window.open(action.url, '_blank')
  }
  
  toast.success(action.name || 'Installation link opened')
}

// Check if current client has install buttons
function hasInstallButtons(): boolean {
  return linkActions.value.length > 0
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
    return t('satelliteConfig.button.copyCommandAndClose')
  }
  if (contentType.value === 'text') {
    return t('satelliteConfig.button.copyInstructionsAndClose')
  }
  return t('satelliteConfig.button.copyAndClose')
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
</script>

<template>
  <AlertDialog :open="props.open" @update:open="(value) => emit('update:open', value)">
    <AlertDialogContent class="max-w-4xl max-h-[75vh] overflow-y-auto">
      <AlertDialogHeader class="pb-4">
        <AlertDialogTitle class="text-xl font-semibold">
          {{ t('satelliteConfig.modal.title') }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('satelliteConfig.modal.description') }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div class="space-y-6">
        <!-- Client Selection Dropdown -->
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('satelliteConfig.modal.clientLabel') }}</label>
          <Select v-model="selectedClient" :disabled="isLoadingClients">
            <SelectTrigger class="w-full">
              <SelectValue
                :placeholder="isLoadingClients ? 'Loading clients...' : t('satelliteConfig.modal.selectPlaceholder')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="client in supportedClients"
                :key="client"
                :value="client"
              >
                {{ getClientDisplayName(client) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- One-Click Install Buttons (shown for supported clients like Cursor) -->
        <div v-if="hasInstallButtons()" class="space-y-3">
          <label class="text-sm font-medium">{{ t('satelliteConfig.modal.oneClickInstall') }}</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="action in linkActions"
              :key="action.url"
              @click="handleInstallClick(action)"
              class="inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              <!-- Cursor install button -->
              <img
                v-if="action.url.includes('cursor')"
                src="/images/provider/cursor-mcp-install-dark.svg"
                :alt="action.name || 'Install'"
                class="h-8 w-auto cursor-pointer"
              />
              <!-- Generic install button for other providers -->
              <Button
                v-else
                variant="outline"
                class="flex items-center gap-2"
              >
                <ExternalLink class="h-4 w-4" />
                {{ action.name || 'Install' }}
              </Button>
            </button>
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
            :placeholder="isLoading ? t('satelliteConfig.modal.loading') : 
              (contentType === 'text' ? t('satelliteConfig.modal.instructionsPlaceholder') : t('satelliteConfig.modal.configPlaceholder'))"
            :disabled="isLoading"
            :class="getTextareaClasses()"
            readonly
          />
        </div>
      </div>

      <AlertDialogFooter class="mt-6">
        <Button @click="handleClose" variant="outline">
          {{ t('actions.close') }}
        </Button>
        <Button
          @click="handleCopyAndClose"
          :loading="isCopying"
          loading-text="Copying..."
          :disabled="!configContent.trim() || isLoading || isLoadingClients"
        >
          {{ getCopyButtonText() }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
