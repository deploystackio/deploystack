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
  Shield
} from 'lucide-vue-next'
import {
  AlertDialog,
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
        {{ t('teams.manage.dangerZone.defaultTeamProtection') }}
      </AlertDescription>
    </Alert>

    <!-- Insufficient Permissions Notice -->
    <Alert v-else-if="!canDeleteTeam" class="border-amber-200 bg-amber-50 text-amber-800">
      <AlertTriangle class="h-4 w-4" />
      <AlertDescription>
        {{ t('teams.manage.dangerZone.insufficientPermissions') }}
      </AlertDescription>
    </Alert>

    <!-- Danger Zone Content -->
    <div v-if="canDeleteTeam" class="space-y-6">
      <!-- Warning Section - Desktop wrapper -->
      <div class="hidden md:block bg-destructive/5 border border-destructive/20 rounded-lg p-6">
        <div class="flex items-start gap-4">
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-destructive mb-2">{{ t('teams.manage.dangerZone.deleteTeamTitle') }}</h3>
            <p class="text-sm text-muted-foreground mb-4">
              {{ t('teams.manage.dangerZone.deleteTeamDescription') }}
            </p>

            <!-- What gets deleted -->
            <div class="bg-background border rounded-lg p-4 mb-4">
              <h4 class="text-sm font-medium mb-3">{{ t('teams.manage.dangerZone.willDelete.title') }}</h4>
              <ul class="text-xs space-y-2">
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  {{ t('teams.manage.dangerZone.willDelete.servers') }}
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  {{ t('teams.manage.dangerZone.willDelete.credentials') }}
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  {{ t('teams.manage.dangerZone.willDelete.variables') }}
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  {{ t('teams.manage.dangerZone.willDelete.history') }}
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  {{ t('teams.manage.dangerZone.willDelete.members') }}
                </li>
              </ul>
            </div>

            <!-- Prerequisites -->
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <h4 class="text-sm font-medium text-amber-800 mb-2">{{ t('teams.manage.dangerZone.prerequisites.title') }}</h4>
              <ul class="text-xs text-amber-700 space-y-1">
                <li>• {{ t('teams.manage.dangerZone.prerequisites.stopServers') }}</li>
                <li>• {{ t('teams.manage.dangerZone.prerequisites.removeConfigs') }}</li>
                <li>• {{ t('teams.manage.dangerZone.prerequisites.noActiveDeployments') }}</li>
              </ul>
            </div>

            <Button
              variant="destructive"
              @click="showDeleteDialog = true"
              class="bg-destructive hover:bg-destructive/90"
            >
              {{ t('teams.manage.dangerZone.deleteButton') }}
            </Button>
          </div>
        </div>
      </div>

      <!-- Warning Section - Mobile (no wrapper) -->
      <div class="block md:hidden space-y-4">
        <h3 class="text-lg font-semibold text-destructive mb-2">{{ t('teams.manage.dangerZone.deleteTeamTitle') }}</h3>
        <p class="text-sm text-muted-foreground mb-4">
          {{ t('teams.manage.dangerZone.deleteTeamDescription') }}
        </p>

        <!-- What gets deleted -->
        <div class="bg-background border rounded-lg p-4 mb-4">
          <h4 class="text-sm font-medium mb-3">{{ t('teams.manage.dangerZone.willDelete.title') }}</h4>
          <ul class="text-xs space-y-2">
            <li class="flex items-start gap-2">
              <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
              {{ t('teams.manage.dangerZone.willDelete.servers') }}
            </li>
            <li class="flex items-start gap-2">
              <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
              {{ t('teams.manage.dangerZone.willDelete.credentials') }}
            </li>
            <li class="flex items-start gap-2">
              <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
              {{ t('teams.manage.dangerZone.willDelete.variables') }}
            </li>
            <li class="flex items-start gap-2">
              <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
              {{ t('teams.manage.dangerZone.willDelete.history') }}
            </li>
            <li class="flex items-start gap-2">
              <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
              {{ t('teams.manage.dangerZone.willDelete.members') }}
            </li>
          </ul>
        </div>

        <!-- Prerequisites -->
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <h4 class="text-sm font-medium text-amber-800 mb-2">{{ t('teams.manage.dangerZone.prerequisites.title') }}</h4>
          <ul class="text-xs text-amber-700 space-y-1">
            <li>• {{ t('teams.manage.dangerZone.prerequisites.stopServers') }}</li>
            <li>• {{ t('teams.manage.dangerZone.prerequisites.removeConfigs') }}</li>
            <li>• {{ t('teams.manage.dangerZone.prerequisites.noActiveDeployments') }}</li>
          </ul>
        </div>

        <Button
          variant="destructive"
          @click="showDeleteDialog = true"
          class="bg-destructive hover:bg-destructive/90"
        >
          {{ t('teams.manage.dangerZone.deleteButton') }}
        </Button>
      </div>

      <!-- Additional Safety Information -->
      <div class="bg-white dark:bg-card border rounded-lg p-4">
        <h4 class="text-sm font-medium mb-2 flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 text-amber-500" />
          {{ t('teams.manage.dangerZone.safetyInfo.title') }}
        </h4>
        <div class="text-xs text-muted-foreground space-y-1">
          <p>• {{ t('teams.manage.dangerZone.safetyInfo.immediate') }}</p>
          <p>• {{ t('teams.manage.dangerZone.safetyInfo.dataLoss') }}</p>
          <p>• {{ t('teams.manage.dangerZone.safetyInfo.noBackups') }}</p>
          <p>• {{ t('teams.manage.dangerZone.safetyInfo.memberAccess') }}</p>
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
          <Button
            variant="destructive"
            @click="deleteTeam"
            :loading="isDeleting"
            :loading-text="t('teams.manage.deleteDialog.deleting')"
            class="bg-destructive hover:bg-destructive/90 gap-2"
          >
            <Trash2 class="h-4 w-4" />
            {{ t('teams.manage.deleteDialog.confirm') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
