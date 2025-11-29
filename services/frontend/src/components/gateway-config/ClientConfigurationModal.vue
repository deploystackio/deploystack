<script setup lang="ts">
import { ref, watch, computed } from 'vue'
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
import { Spinner } from '@/components/ui/spinner'
import { GatewayConfigService, type ClientConfigResponse, type ClientInfo, type ConfigAction } from '@/services/satelliteConfigService'
import { toast } from 'vue-sonner'
import LinkActionRenderer from '@/components/client-config/LinkActionRenderer.vue'
import StepsActionRenderer from '@/components/client-config/StepsActionRenderer.vue'
import CommandActionRenderer from '@/components/client-config/CommandActionRenderer.vue'
import JsonActionRenderer from '@/components/client-config/JsonActionRenderer.vue'

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
const actions = ref<ConfigAction[]>([])
const isLoading = ref(false)
const supportedClients = ref<ClientInfo[]>([])
const isLoadingClients = ref(false)
const isCopying = ref(false)

// Computed: Check if current actions have copyable content (JSON or command)
const hasCopyableContent = computed(() => {
  return actions.value.some(action => action.type === 'json' || action.type === 'command')
})

// Computed: Get the content to copy
const copyableContent = computed(() => {
  const action = actions.value.find(a => a.type === 'json' || a.type === 'command')
  if (!action) return ''

  if (action.type === 'command') {
    return action.command
  }

  if (action.type === 'json') {
    // Use pre-formatted jsonContent if available
    if (action.jsonContent) {
      return action.jsonContent
    }
    // Otherwise format the data fields
    const data = action.servers || action.mcpServers || action.inputs
    return JSON.stringify(data, null, 2)
  }

  return ''
})

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
        selectedClient.value = firstClient.id
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load supported clients'
    toast.error(errorMessage)
  } finally {
    isLoadingClients.value = false
  }
}

// Load configuration from API (only connection category)
async function loadConfiguration(client: string) {
  isLoading.value = true
  try {
    const response: ClientConfigResponse = await GatewayConfigService.getClientConfig(client, 'connection')
    actions.value = response
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load configuration'
    toast.error(errorMessage)
    actions.value = []
  } finally {
    isLoading.value = false
  }
}

function handleClose() {
  emit('update:open', false)
}

// Handle copy and close
async function handleCopyAndClose() {
  if (!copyableContent.value) {
    toast.error('No content to copy')
    return
  }

  isCopying.value = true

  try {
    await navigator.clipboard.writeText(copyableContent.value)
    handleClose()
    // Show success toast after modal closes
    setTimeout(() => {
      toast.success(t('satelliteConfig.messages.copySuccess'))
    }, 100)
  } catch {
    toast.error('Failed to copy to clipboard')
  } finally {
    isCopying.value = false
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
                :key="client.id"
                :value="client.id"
              >
                {{ client.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-8 text-muted-foreground">
          {{ t('satelliteConfig.modal.loading') }}
        </div>

        <!-- Actions Rendering -->
        <div v-else class="space-y-6">
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
              :show-copy-button="false"
            />

            <!-- JSON Actions -->
            <JsonActionRenderer
              v-else-if="action.type === 'json'"
              :action="action"
              :show-copy-button="false"
            />
          </template>
        </div>
      </div>

      <AlertDialogFooter class="mt-6">
        <Button @click="handleClose" variant="outline">
          {{ t('actions.close') }}
        </Button>
        <Button
          v-if="hasCopyableContent"
          @click="handleCopyAndClose"
          :disabled="isCopying || !copyableContent || isLoading || isLoadingClients"
        >
          <Spinner v-if="isCopying" class="mr-2" />
          {{ t('satelliteConfig.button.copyAndClose') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
