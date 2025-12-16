<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { DsCard } from '@/components/ui/ds-card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Trash2, Lock } from 'lucide-vue-next'
import { McpInstallationService } from '@/services/mcpInstallationService'
import type { McpInstallation } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
  teamId: string
  canEdit?: boolean
  userRole?: 'team_admin' | 'team_user' | null
}

const props = withDefaults(defineProps<Props>(), {
  canEdit: true,
  userRole: null
})
const { t } = useI18n()
const router = useRouter()

const showUninstallModal = ref(false)
const isUninstalling = ref(false)
const error = ref<string | null>(null)

async function handleUninstall() {
  if (isUninstalling.value) return

  try {
    isUninstalling.value = true
    error.value = null

    // Remove the installation using the provided team ID
    await McpInstallationService.removeInstallation(props.teamId, props.installation.id)

    // Close modal
    showUninstallModal.value = false

    // Show success toast
    toast.success(t('mcpInstallations.notifications.uninstallSuccess'), {
      description: t('mcpInstallations.removal.notifications.success')
    })

    // Navigate back to MCP servers list
    router.push('/mcp-server')

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
    error.value = errorMessage
    
    // Show error toast
    toast.error(t('mcpInstallations.removal.notifications.genericError', { error: errorMessage }), {
      description: t('mcpInstallations.details.dangerZone.uninstall.modal.warning')
    })
  } finally {
    isUninstalling.value = false
  }
}

function openUninstallModal() {
  // Check if user has permission to delete
  if (!props.canEdit) {
    return
  }
  
  error.value = null
  showUninstallModal.value = true
}

function closeUninstallModal() {
  if (isUninstalling.value) return
  showUninstallModal.value = false
  error.value = null
}
</script>

<template>
  <div class="space-y-6">
    <!-- Uninstall MCP Server Section -->
    <DsCard :title="t('mcpInstallations.details.dangerZone.uninstall.label')">
      <p class="text-sm text-muted-foreground mb-4">
        {{ t('mcpInstallations.details.dangerZone.uninstall.warning') }}
      </p>

      <template #footer-actions>
        <TooltipProvider v-if="!canEdit">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="destructive"
                class="cursor-not-allowed opacity-50"
                disabled
              >
                <Lock class="h-4 w-4 mr-2" />
                {{ t('mcpInstallations.details.dangerZone.uninstall.button') }}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{{ t('mcpInstallations.details.dangerZone.uninstall.disabledTooltip') }}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button
          v-else
          variant="destructive"
          @click="openUninstallModal"
        >
          <Trash2 class="h-4 w-4 mr-2" />
          {{ t('mcpInstallations.details.dangerZone.uninstall.button') }}
        </Button>
      </template>
    </DsCard>

    <!-- Uninstall Confirmation Modal -->
    <AlertDialog :open="showUninstallModal" @update:open="closeUninstallModal">
      <AlertDialogContent class="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ t('mcpInstallations.details.dangerZone.uninstall.modal.title') }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('mcpInstallations.details.dangerZone.uninstall.modal.description', {
              name: installation.installation_name
            }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <!-- Error Message -->
        <div v-if="error" class="bg-destructive/10 border border-destructive/20 rounded-md p-3">
          <p class="text-sm text-destructive">{{ error }}</p>
        </div>

        <!-- Warning -->
        <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p class="text-sm text-yellow-800">
            {{ t('mcpInstallations.details.dangerZone.uninstall.modal.warning') }}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel @click="closeUninstallModal" :disabled="isUninstalling">
            {{ t('mcpInstallations.details.dangerZone.uninstall.modal.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction
            @click="handleUninstall"
            :disabled="isUninstalling"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 v-if="!isUninstalling" class="h-4 w-4 mr-2" />
            {{ isUninstalling
              ? t('mcpInstallations.details.dangerZone.uninstall.modal.uninstalling')
              : t('mcpInstallations.details.dangerZone.uninstall.modal.confirm')
            }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
