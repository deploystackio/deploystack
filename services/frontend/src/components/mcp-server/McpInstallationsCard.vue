<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Plus,
  MoreHorizontal,
  Settings,
  Trash2,
  Server,
  Eye,
  AlertTriangle
} from 'lucide-vue-next'
import type { McpInstallation } from '@/types/mcp-installations'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService } from '@/services/teamService'

interface Props {
  installations: McpInstallation[]
  hasInstallations: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  installServer: []
  viewInstallation: [serverId: string]
  manageInstallation: [installationId: string]
  removeInstallation: [installationId: string]
}>()

const { t } = useI18n()

// Modal state
const showDeleteModal = ref(false)
const isDeleting = ref(false)
const deleteError = ref<string | null>(null)
const installationToDelete = ref<McpInstallation | null>(null)

// Find which team owns the installation
async function findInstallationTeam(installationId: string): Promise<{ teamId: string; installation: McpInstallation } | null> {
  try {
    // First check if the installation has a team_id (for direct lookup)
    const installation = props.installations.find(inst => inst.id === installationId)
    if (installation && installation.team_id) {
      return { teamId: installation.team_id, installation }
    }

    // Fallback to searching through user's teams
    const userTeams = await TeamService.getUserTeams()

    for (const team of userTeams) {
      try {
        const installations = await McpInstallationService.getTeamInstallations(team.id)
        const foundInstallation = installations.find(inst => inst.id === installationId)

        if (foundInstallation) {
          return { teamId: team.id, installation: foundInstallation }
        }
      } catch {
        // Continue to next team if not found
        continue
      }
    }

    return null
  } catch {
    return null
  }
}

// Computed
const sortedInstallations = computed(() => {
  return [...props.installations].sort((a, b) =>
    a.installation_name.localeCompare(b.installation_name)
  )
})

// Methods
const getStatusVariant = (status: McpInstallation['status']) => {
  switch (status) {
    case 'active':
      return 'default'
    case 'error':
      return 'destructive'
    case 'installing':
      return 'secondary'
    case 'stopped':
      return 'outline'
    default:
      return 'secondary'
  }
}

const getStatusText = (status: McpInstallation['status']) => {
  return t(`mcpInstallations.status.${status}`)
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const getEnvironmentVariablesCount = (envVars: Record<string, string>) => {
  return Object.keys(envVars).length
}

const handleView = (serverId: string) => {
  emit('viewInstallation', serverId)
}

const handleManage = (installationId: string) => {
  emit('manageInstallation', installationId)
}

const handleRemove = (installationId: string) => {
  const installation = props.installations.find(inst => inst.id === installationId)
  if (installation) {
    installationToDelete.value = installation
    deleteError.value = null
    showDeleteModal.value = true
  }
}

const confirmRemoval = async () => {
  if (!installationToDelete.value) return

  try {
    isDeleting.value = true
    deleteError.value = null

    // Find which team owns this installation
    const result = await findInstallationTeam(installationToDelete.value.id)

    if (!result) {
      deleteError.value = t('mcpInstallations.removal.notifications.notFoundError')
      return
    }

    // Call the API to remove the installation
    await McpInstallationService.removeInstallation(result.teamId, installationToDelete.value.id)

    // Emit success event
    emit('removeInstallation', installationToDelete.value.id)

    // Close modal
    showDeleteModal.value = false
    installationToDelete.value = null

  } catch (err) {
    // Handle specific error types
    if (err instanceof Error) {
      if (err.message.includes('403') || err.message.includes('permission')) {
        deleteError.value = t('mcpInstallations.removal.notifications.permissionError')
      } else if (err.message.includes('404') || err.message.includes('not found')) {
        deleteError.value = t('mcpInstallations.removal.notifications.notFoundError')
      } else {
        deleteError.value = t('mcpInstallations.removal.notifications.genericError', { error: err.message })
      }
    } else {
      deleteError.value = t('mcpInstallations.removal.notifications.genericError', { error: 'Unknown error' })
    }
  } finally {
    isDeleting.value = false
  }
}

const cancelRemoval = () => {
  deleteError.value = null
  showDeleteModal.value = false
  installationToDelete.value = null
}

const handleInstallServer = () => {
  emit('installServer')
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t('mcpInstallations.title') }}</CardTitle>
      <CardDescription>
        {{ t('mcpInstallations.description') }}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <!-- Empty State -->
      <div v-if="!hasInstallations" class="text-center py-8">
        <Server class="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 class="text-lg font-medium mb-2">
          {{ t('mcpInstallations.emptyState.title') }}
        </h3>
        <p class="text-muted-foreground mb-4">
          {{ t('mcpInstallations.emptyState.description') }}
        </p>
        <Button @click="handleInstallServer" class="flex items-center gap-2">
          <Plus class="h-4 w-4" />
          {{ t('mcpInstallations.actions.install') }}
        </Button>
      </div>

      <!-- Installations List -->
      <div v-else class="space-y-4">
        <div class="grid gap-4">
          <div
            v-for="installation in sortedInstallations"
            :key="installation.id"
            class="flex items-center justify-between space-x-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <!-- Left side: Server info -->
            <div class="flex items-center space-x-4 flex-1 min-w-0">
              <!-- Server Icon -->
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Server class="h-5 w-5 text-primary" />
                </div>
              </div>

              <!-- Server Details -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <p class="text-sm font-medium leading-none truncate">
                    {{ installation.installation_name }}
                  </p>
                  <Badge :variant="getStatusVariant(installation.status)" class="text-xs">
                    {{ getStatusText(installation.status) }}
                  </Badge>
                </div>
                <p class="text-sm text-muted-foreground truncate mb-1">
                  {{ installation.server.description }}
                </p>
                <div class="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{{ installation.server.language }} • {{ installation.server.runtime }}</span>
                  <span>{{ getEnvironmentVariablesCount(installation.user_environment_variables) }} env vars</span>
                  <span>{{ formatDate(installation.created_at) }}</span>
                </div>
              </div>
            </div>

            <!-- Right side: Actions -->
            <div class="flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" class="h-8 w-8 p-0">
                    <span class="sr-only">{{ t('mcpInstallations.actions.openMenu') }}</span>
                    <MoreHorizontal class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="handleView(installation.server.id)">
                    <Eye class="h-4 w-4 mr-2" />
                    {{ t('mcpInstallations.actions.view') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="handleManage(installation.id)">
                    <Settings class="h-4 w-4 mr-2" />
                    {{ t('mcpInstallations.actions.configure') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    @click="handleRemove(installation.id)"
                    class="text-destructive focus:text-destructive"
                  >
                    <Trash2 class="h-4 w-4 mr-2" />
                    {{ t('mcpInstallations.actions.remove') }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

      </div>
    </CardContent>
  </Card>

  <!-- Delete Confirmation Modal -->
  <AlertDialog v-model:open="showDeleteModal">
    <AlertDialogContent class="sm:max-w-[425px]">
      <AlertDialogHeader>
        <AlertDialogTitle class="flex items-center gap-2 text-red-600">
          <AlertTriangle class="h-5 w-5" />
          {{ t('mcpInstallations.removal.modal.title') }}
        </AlertDialogTitle>
        <AlertDialogDescription class="text-left">
          {{ t('mcpInstallations.removal.modal.description', {
            name: installationToDelete?.installation_name || ''
          }) }}
          <br><br>
          <span class="text-red-600 font-medium">
            {{ t('mcpInstallations.removal.modal.warning') }}
          </span>
        </AlertDialogDescription>
      </AlertDialogHeader>

      <!-- Delete Error Display -->
      <Alert v-if="deleteError" variant="destructive" class="mx-6">
        <AlertTriangle class="h-4 w-4" />
        <AlertDescription>
          {{ deleteError }}
        </AlertDescription>
      </Alert>

      <AlertDialogFooter class="flex gap-2">
        <AlertDialogCancel
          @click="cancelRemoval"
          :disabled="isDeleting"
        >
          {{ t('mcpInstallations.removal.modal.cancelButton') }}
        </AlertDialogCancel>
        <AlertDialogAction
          @click="confirmRemoval"
          :disabled="isDeleting"
          class="bg-red-600 hover:bg-red-700"
        >
          <Trash2 v-if="!isDeleting" class="h-4 w-4 mr-2" />
          <div v-else class="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          {{ isDeleting ? t('mcpInstallations.removal.modal.removing') : t('mcpInstallations.removal.modal.confirmButton') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
