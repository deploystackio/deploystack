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
const selectedClient = ref('claude-desktop')
const configContent = ref('')
const isLoading = ref(false)
const isCopying = ref(false)

// Load configuration when client changes
watch(selectedClient, async (newClient) => {
  if (newClient) {
    await loadConfiguration(newClient)
  }
}, { immediate: true })

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
  } catch (error) {
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
        <!-- Client Selection Dropdown -->
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('gatewayConfig.modal.clientLabel') }}</label>
          <Select v-model="selectedClient">
            <SelectTrigger class="w-full">
              <SelectValue :placeholder="t('gatewayConfig.modal.selectPlaceholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-desktop">
                {{ t('gatewayConfig.clients.claudeDesktop') }}
              </SelectItem>
              <SelectItem value="cursor">
                {{ t('gatewayConfig.clients.cursor') }}
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
            rows="12"
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
          :disabled="!configContent.trim() || isLoading"
        >
          {{ t('gatewayConfig.button.copyAndClose') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
