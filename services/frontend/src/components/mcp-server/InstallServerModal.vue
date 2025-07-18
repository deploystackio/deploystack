<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-vue-next'
import type { McpInstallation } from '@/types/mcp-installations'

interface Props {
  open: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'installation-created': [installation: McpInstallation]
}>()

const { t } = useI18n()

// State
const isLoading = ref(false)
const installationName = ref('')

// Watch for modal open/close to reset form
watch(() => props.open, (newValue) => {
  if (newValue) {
    // Reset form when modal opens
    installationName.value = ''
    isLoading.value = false
  }
})

// Methods
const handleClose = () => {
  emit('update:open', false)
}

const handleInstall = async () => {
  if (!installationName.value.trim()) {
    return
  }

  try {
    isLoading.value = true

    // TODO: Implement actual installation logic
    // This is a mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000))

    const mockInstallation: McpInstallation = {
      id: Date.now().toString(),
      installation_name: installationName.value,
      server_id: 'mock-server',
      server: {
        id: 'mock-server',
        name: 'Mock Server',
        description: 'A mock MCP server for testing',
        language: 'JavaScript',
        runtime: 'node',
        status: 'active'
      },
      status: 'active',
      user_environment_variables: {},
      team_id: 'team-123',
      created_by: 'current-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    emit('installation-created', mockInstallation)
  } catch (error) {
    console.error('Failed to install MCP server:', error)
  } finally {
    isLoading.value = false
  }
}

const isFormValid = () => {
  return installationName.value.trim().length > 0
}
</script>

<template>
  <AlertDialog :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogContent class="sm:max-w-[425px]">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('mcpInstallations.installation.modal.title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('mcpInstallations.installation.modal.description') }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <form @submit.prevent="handleInstall" class="space-y-4">
        <!-- Installation Name -->
        <div class="space-y-2">
          <Label for="installation-name">
            {{ t('mcpInstallations.installation.form.installationName.label') }}
          </Label>
          <Input
            id="installation-name"
            v-model="installationName"
            :placeholder="t('mcpInstallations.installation.form.installationName.placeholder')"
            required
          />
        </div>

        <!-- TODO: Add server selection and environment variables form -->
        <div class="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
          <p class="font-medium mb-2">Coming Soon:</p>
          <ul class="space-y-1 text-xs">
            <li>• Server catalog browser</li>
            <li>• Environment variables configuration</li>
            <li>• Installation preview and confirmation</li>
          </ul>
        </div>

        <AlertDialogFooter>
          <Button type="button" variant="outline" @click="handleClose">
            {{ t('mcpInstallations.buttons.cancel') }}
          </Button>
          <Button
            type="submit"
            :disabled="!isFormValid() || isLoading"
            class="flex items-center gap-2"
          >
            <Plus v-if="!isLoading" class="h-4 w-4" />
            {{ isLoading ? t('mcpInstallations.buttons.installing') : t('mcpInstallations.actions.install') }}
          </Button>
        </AlertDialogFooter>
      </form>
    </AlertDialogContent>
  </AlertDialog>
</template>
