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
import { GatewayConfigService } from '@/services/gatewayConfigService'
import { toast } from 'vue-sonner'

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
    const config = await GatewayConfigService.getClientConfig(client)
    configContent.value = JSON.stringify(config, null, 2)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load configuration'
    toast.error(errorMessage)
    configContent.value = `Error: ${errorMessage}`
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

  const translationKey = `gatewayConfig.clients.${clientKey}`
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
      toast.success(t('gatewayConfig.messages.copySuccess'))
    }, 100)
  } catch {
    toast.error('Failed to copy configuration to clipboard')
  } finally {
    isCopying.value = false
  }
}
</script>

<template>
  <AlertDialog :open="props.open" @update:open="(value) => emit('update:open', value)">
    <AlertDialogContent class="max-w-4xl max-h-[75vh] overflow-y-auto">
      <AlertDialogHeader class="pb-4">
        <AlertDialogTitle class="text-xl font-semibold">
          {{ t('gatewayConfig.modal.title') }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('gatewayConfig.modal.description') }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div class="space-y-6">
        <!-- Installation Step -->
        <div class="space-y-3">
          <label class="text-sm font-medium">First, install the DeployStack Gateway</label>
          <div class="rounded-lg bg-gray-900 shadow-lg border border-gray-700 overflow-hidden">
            <!-- Terminal Header -->
            <div class="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-600">
              <div class="flex items-center space-x-2">
                <div class="w-3 h-3 rounded-full bg-red-500"></div>
                <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div class="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div class="text-gray-400 text-sm font-mono">
                ~/setup
              </div>
              <div class="w-16"></div>
            </div>

            <!-- Terminal Body -->
            <div class="p-4 bg-gray-900">
              <div class="font-mono text-sm">
                <div class="text-gray-300 mb-1">
                  <span class="text-white">$ </span><span class="text-yellow-300">npm install -g @deploystack/gateway</span>
                </div>
                <div class="text-gray-300 mb-3">
                  <span class="text-white">$ </span><span class="text-yellow-300">deploystack login</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Client Selection Dropdown -->
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('gatewayConfig.modal.clientLabel') }}</label>
          <Select v-model="selectedClient" :disabled="isLoadingClients">
            <SelectTrigger class="w-full">
              <SelectValue
                :placeholder="isLoadingClients ? 'Loading clients...' : t('gatewayConfig.modal.selectPlaceholder')"
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

        <!-- Configuration Content -->
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('gatewayConfig.modal.configLabel') }}</label>
          <Textarea
            v-model="configContent"
            :placeholder="isLoading ? t('gatewayConfig.modal.loading') : t('gatewayConfig.modal.configPlaceholder')"
            :disabled="isLoading"
            rows="8"
            class="font-mono text-sm"
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
          {{ t('gatewayConfig.button.copyAndClose') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
