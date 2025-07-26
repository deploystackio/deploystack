<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Trash2, 
  AlertTriangle,
  XCircle,
  Loader2,
  Shield
} from 'lucide-vue-next'
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
import { TeamService, type Team } from '@/services/teamService'

const { t } = useI18n()
const router = useRouter()

interface Props {
  team: Team
  canDeleteTeam: boolean
}

const props = defineProps<Props>()

// State
const isDeleting = ref(false)
const error = ref<string | null>(null)
const showDeleteDialog = ref(false)

// Delete team
const deleteTeam = async () => {
  try {
    isDeleting.value = true
    error.value = null
    const teamName = props.team.name || 'Unknown Team'
    
    await TeamService.deleteTeam(props.team.id)

    // Show success toast
    toast.success(t('teams.messages.deleteSuccess', { teamName }), {
      description: t('teams.messages.deleteSuccessDescription')
    })

    // Redirect to teams list
    router.push('/teams')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete team'
    console.error('Error deleting team:', err)
  } finally {
    isDeleting.value = false
    showDeleteDialog.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Error Display -->
    <Alert v-if="error" variant="destructive">
      <XCircle class="h-4 w-4" />
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <!-- Default Team Protection Notice -->
    <Alert v-if="!canDeleteTeam && team.is_default" class="border-blue-200 bg-blue-50 text-blue-800">
      <Shield class="h-4 w-4" />
      <AlertDescription>
        This is your default team and cannot be deleted. Your default team provides a permanent workspace for your personal deployments.
      </AlertDescription>
    </Alert>

    <!-- Insufficient Permissions Notice -->
    <Alert v-else-if="!canDeleteTeam" class="border-amber-200 bg-amber-50 text-amber-800">
      <AlertTriangle class="h-4 w-4" />
      <AlertDescription>
        You do not have permission to delete this team. Only team owners can delete teams.
      </AlertDescription>
    </Alert>

    <!-- Danger Zone Content -->
    <div v-if="canDeleteTeam" class="space-y-6">
      <!-- Warning Section -->
      <div class="bg-destructive/5 border border-destructive/20 rounded-lg p-6">
        <div class="flex items-start gap-4">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle class="h-5 w-5 text-destructive" />
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-destructive mb-2">Delete Team</h3>
            <p class="text-sm text-muted-foreground mb-4">
              Permanently delete this team and all associated resources. This action cannot be undone.
            </p>
            
            <!-- What gets deleted -->
            <div class="bg-background border rounded-lg p-4 mb-4">
              <h4 class="text-sm font-medium mb-3">This will permanently delete:</h4>
              <ul class="text-xs space-y-2">
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  All MCP server configurations and deployments
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  All cloud provider credentials and API keys
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  All global environment variables
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  Complete deployment history and logs
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  All team member associations
                </li>
              </ul>
            </div>

            <!-- Prerequisites -->
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <h4 class="text-sm font-medium text-amber-800 mb-2">Before you can delete this team:</h4>
              <ul class="text-xs text-amber-700 space-y-1">
                <li>• Stop and remove all running MCP servers</li>
                <li>• Remove all server configurations</li>
                <li>• Ensure no active deployments are running</li>
              </ul>
            </div>

            <Button
              variant="destructive"
              @click="showDeleteDialog = true"
              class="gap-2 bg-destructive hover:bg-destructive/90"
            >
              <Trash2 class="h-4 w-4" />
              Delete Team
            </Button>
          </div>
        </div>
      </div>

      <!-- Additional Safety Information -->
      <div class="bg-muted/50 rounded-lg p-4">
        <h4 class="text-sm font-medium mb-2 flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 text-amber-500" />
          Important Safety Information
        </h4>
        <div class="text-xs text-muted-foreground space-y-1">
          <p>• Team deletion is immediate and cannot be undone</p>
          <p>• All data will be permanently lost</p>
          <p>• No backups or recovery options are available</p>
          <p>• Team members will lose access immediately</p>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <AlertDialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
      <AlertDialogContent class="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle class="flex items-center gap-2 text-destructive">
            <AlertTriangle class="h-5 w-5" />
            {{ t('teams.manage.deleteDialog.title') }}
          </AlertDialogTitle>
          <AlertDialogDescription class="space-y-4">
            <p>{{ t('teams.manage.deleteDialog.warning') }}</p>
            
            <div class="rounded-lg border p-3 bg-muted/50">
              <p class="font-medium text-sm mb-1">{{ t('teams.manage.deleteDialog.teamName') }}:</p>
              <p class="font-mono text-sm">"{{ team.name }}"</p>
            </div>
            
            <div class="rounded-lg border-destructive/50 bg-destructive/5 p-4 space-y-3">
              <p class="text-sm font-medium text-destructive">{{ t('teams.manage.deleteDialog.consequences') }}</p>
              <ul class="text-xs space-y-2">
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  {{ t('teams.manage.deleteDialog.consequencesList.servers') }}
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  {{ t('teams.manage.deleteDialog.consequencesList.credentials') }}
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  {{ t('teams.manage.deleteDialog.consequencesList.variables') }}
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  {{ t('teams.manage.deleteDialog.consequencesList.history') }}
                </li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="showDeleteDialog = false">
            {{ t('teams.manage.deleteDialog.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction
            @click="deleteTeam"
            :disabled="isDeleting"
            class="bg-destructive hover:bg-destructive/90 gap-2"
          >
            <Loader2 v-if="isDeleting" class="h-4 w-4 animate-spin" />
            <Trash2 v-else class="h-4 w-4" />
            {{ isDeleting ? t('teams.manage.deleteDialog.deleting') : t('teams.manage.deleteDialog.confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
