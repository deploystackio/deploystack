<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
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
import { Trash2 } from 'lucide-vue-next'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService } from '@/services/teamService'
import { useEventBus } from '@/composables/useEventBus'
import type { McpInstallation } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
}

const props = defineProps<Props>()
const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()

const showUninstallModal = ref(false)
const isUninstalling = ref(false)
const error = ref<string | null>(null)

// Find which team owns the installation
async function findInstallationTeam(installationId: string): Promise<string | null> {
  try {
    const userTeams = await TeamService.getUserTeams()
    for (const team of userTeams) {
      try {
        await McpInstallationService.getInstallationById(team.id, installationId)
        return team.id
      } catch {
        continue
      }
    }
    return null
  } catch {
    return null
  }
}

async function handleUninstall() {
  if (isUninstalling.value) return

  try {
    isUninstalling.value = true
    error.value = null

    // Find the team that owns this installation
    const teamId = await findInstallationTeam(props.installation.id)
    if (!teamId) {
      throw new Error('Could not find team for this installation')
    }

    // Remove the installation
    await McpInstallationService.removeInstallation(teamId, props.installation.id)

    // Close modal
    showUninstallModal.value = false

    // Store success notification for persistence across navigation
    const message = t('mcpInstallations.notifications.uninstallSuccess')

    // Use event bus storage to persist notification across navigation
    eventBus.setState('pending_notification', {
      message,
      type: 'success',
      timestamp: Date.now()
    })

    // Navigate back to MCP servers list
    router.push('/mcp-server')

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error occurred'
  } finally {
    isUninstalling.value = false
  }
}

function openUninstallModal() {
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
    <!-- Header -->
    <div>
      <h2 class="text-xl font-semibold">
        {{ t('mcpInstallations.details.dangerZone.title') }}
      </h2>
      <p class="text-muted-foreground mt-1">
        {{ t('mcpInstallations.details.dangerZone.description') }}
      </p>
    </div>

    <!-- Uninstall MCP Server Section -->
    <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
      <dt class="text-sm/6 font-medium text-gray-900">
        {{ t('mcpInstallations.details.dangerZone.uninstall.label') }}
      </dt>
      <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
        <div class="flex items-center justify-between">
          <div>
            <Button
              variant="destructive"
              @click="openUninstallModal"
            >
              {{ t('mcpInstallations.details.dangerZone.uninstall.button') }}
            </Button>
          </div>
        </div>
      </dd>
    </div>

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
