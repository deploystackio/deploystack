<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Save,
  Lock,
  Calendar,
  Users,
  Hash,
  AlertTriangle,
  Trash2,
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
import { DsCard } from '@/components/ui/ds-card'
import { z } from 'zod'

const { t } = useI18n()
const router = useRouter()

interface Props {
  team: Team
  canEditName: boolean
  canEditDescription: boolean
  canDeleteTeam: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  teamUpdated: [team: Team]
}>()

// Form state
const isSaving = ref(false)
const saveError = ref<string | null>(null)

// Delete state
const isDeleting = ref(false)
const deleteError = ref<string | null>(null)
const showDeleteDialog = ref(false)

// Form data
const formData = ref({
  name: props.team.name,
  description: props.team.description || ''
})

// Validation schema
const TeamUpdateSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional()
})

// Computed properties
const isDefaultTeam = computed(() => {
  return props.team.is_default === true
})

const hasChanges = computed(() => {
  return formData.value.name !== props.team.name ||
         formData.value.description !== (props.team.description || '')
})

const formattedCreatedDate = computed(() => {
  if (!props.team.created_at) return ''
  return new Date(props.team.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const formattedUpdatedDate = computed(() => {
  if (!props.team.updated_at) return ''
  return new Date(props.team.updated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

// Save team changes
const saveTeam = async () => {
  try {
    isSaving.value = true
    saveError.value = null

    // Validate form data
    const validatedData = TeamUpdateSchema.parse(formData.value)

    // Prepare update data
    const updateData: Partial<Team> = {}

    if (props.canEditName && validatedData.name !== props.team.name) {
      updateData.name = validatedData.name
    }

    if (props.canEditDescription && validatedData.description !== props.team.description) {
      updateData.description = validatedData.description || null
    }

    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      const updatedTeam = await TeamService.updateTeam(props.team.id, updateData)
      emit('teamUpdated', updatedTeam)

      // Show success toast
      toast.success(t('teams.manage.saveSuccess'), {
        description: t('teams.manage.saveSuccessDescription')
      })
    }

  } catch (err) {
    if (err instanceof z.ZodError) {
      saveError.value = err.issues.map(e => e.message).join(', ')
    } else {
      saveError.value = err instanceof Error ? err.message : 'Failed to save team'
    }
    console.error('Error saving team:', err)

    // Show error toast
    toast.error(t('teams.manage.saveError'), {
      description: saveError.value
    })
  } finally {
    isSaving.value = false
  }
}

// Delete team
const deleteTeam = async () => {
  try {
    isDeleting.value = true
    deleteError.value = null
    const teamName = props.team.name || 'Unknown Team'

    await TeamService.deleteTeam(props.team.id)

    toast.success(t('teams.messages.deleteSuccess', { teamName }), {
      description: t('teams.messages.deleteSuccessDescription')
    })

    router.push('/teams')
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Failed to delete team'
    console.error('Error deleting team:', err)
  } finally {
    isDeleting.value = false
    showDeleteDialog.value = false
  }
}

// Update form data when team prop changes
const updateFormData = () => {
  formData.value = {
    name: props.team.name,
    description: props.team.description || ''
  }
}

// Watch for team changes and update form data
watch(() => props.team, () => {
  updateFormData()
}, { deep: true })
</script>

<template>
  <div>
    <!-- Team Information Section -->
    <DsCard :title="t('teams.manage.teamDetails')">
      <p class="text-sm mb-6">{{ t('teams.manage.teamDetailsDescription') }}</p>
      <dl class="divide-y divide-gray-100">
          <!-- Team Name -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
              {{ t('teams.manage.fields.name.label') }}
              <Lock v-if="!canEditName" class="h-3 w-3 text-muted-foreground" />
            </dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <div v-if="canEditName" class="space-y-2">
                <Input
                  v-model="formData.name"
                  :placeholder="t('teams.manage.fields.name.placeholder')"
                  class="max-w-lg"
                />
                <div class="space-y-1">
                  <p v-if="isDefaultTeam" class="text-xs text-muted-foreground flex items-start gap-2">
                    <AlertTriangle class="h-3 w-3 mt-0.5 text-amber-500" />
                    {{ t('teams.manage.fields.name.defaultTeamNote') }}
                  </p>
                </div>
              </div>
              <div v-else class="flex items-center gap-2">
                <span>{{ team.name }}</span>
                <Badge v-if="isDefaultTeam" variant="secondary" class="gap-1">
                  <Users class="h-3 w-3" />
                  {{ t('teams.manage.defaultTeam') }}
                </Badge>
              </div>
              <p v-if="!canEditName" class="text-xs text-muted-foreground flex items-start gap-2 mt-2">
                <Lock class="h-3 w-3 mt-0.5" />
                {{ t('teams.manage.fields.name.noPermission') }}
              </p>
            </dd>
          </div>

          <!-- Team Description -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
              {{ t('teams.manage.fields.description.label') }}
              <Lock v-if="!canEditDescription" class="h-3 w-3 text-muted-foreground" />
            </dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <div v-if="canEditDescription" class="space-y-2">
                <textarea
                  v-model="formData.description"
                  :placeholder="t('teams.manage.fields.description.placeholder')"
                  class="flex min-h-[100px] w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  rows="4"
                />
              </div>
              <div v-else>
                {{ team.description || t('teams.manage.fields.description.noDescription') }}
              </div>
              <p v-if="!canEditDescription" class="text-xs text-muted-foreground flex items-start gap-2 mt-2">
                <Lock class="h-3 w-3 mt-0.5" />
                {{ t('teams.manage.fields.description.noPermission') }}
              </p>
            </dd>
          </div>

          <!-- Team ID -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
              <Hash class="h-4 w-4 text-muted-foreground" />
              {{ t('teams.manage.teamId') }}
            </dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <span class="font-mono text-xs">{{ team.id }}</span>
            </dd>
          </div>

          <!-- Team Information -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900">{{ t('teams.manage.teamInfo') }}</dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <div class="space-y-2">
                <div class="flex items-center gap-1">
                  <Calendar class="h-4 w-4 text-muted-foreground" />
                  <span class="font-medium">{{ t('teams.manage.created') }}</span> {{ formattedCreatedDate }}
                </div>
                <div class="flex items-center gap-1">
                  <Calendar class="h-4 w-4 text-muted-foreground" />
                  <span class="font-medium">{{ t('teams.manage.updated') }}</span> {{ formattedUpdatedDate }}
                </div>
                <div v-if="isDefaultTeam" class="flex items-center gap-1">
                  <Users class="h-4 w-4 text-muted-foreground" />
                  <span class="font-medium">{{ t('teams.manage.status') }}</span>
                  <Badge variant="secondary" class="gap-1">
                    <Users class="h-3 w-3" />
                    {{ t('teams.manage.defaultTeam') }}
                  </Badge>
                </div>
              </div>
            </dd>
          </div>
        </dl>

      <template #footer-actions>
        <Button
          @click="saveTeam"
          :disabled="!hasChanges || isSaving"
          class="gap-2"
        >
          <Spinner v-if="isSaving" class="mr-2" />
          <Save v-else class="h-4 w-4" />
          {{ t('teams.manage.save') }}
        </Button>
      </template>
    </DsCard>

    <!-- Danger Zone Section -->
    <DsCard :title="t('teams.manage.dangerZone.title')">
      <!-- Delete Error Display -->
      <Alert v-if="deleteError" variant="destructive" class="mb-4">
        <XCircle class="h-4 w-4" />
        <AlertDescription>{{ deleteError }}</AlertDescription>
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

      <!-- Delete Team Content -->
      <div v-else class="space-y-4">
        <p class="text-sm text-muted-foreground">
          {{ t('teams.manage.dangerZone.deleteTeamDescription') }}
        </p>

        <!-- What gets deleted -->
        <div class="bg-muted/50 border rounded-lg p-4">
          <h4 class="text-sm font-medium mb-3">{{ t('teams.manage.dangerZone.willDelete.title') }}</h4>
          <ul class="text-xs space-y-2">
            <li class="flex items-start gap-2">
              <XCircle class="h-3 w-3 text-destructive mt-0.5 shrink-0" />
              {{ t('teams.manage.dangerZone.willDelete.servers') }}
            </li>
            <li class="flex items-start gap-2">
              <XCircle class="h-3 w-3 text-destructive mt-0.5 shrink-0" />
              {{ t('teams.manage.dangerZone.willDelete.credentials') }}
            </li>
            <li class="flex items-start gap-2">
              <XCircle class="h-3 w-3 text-destructive mt-0.5 shrink-0" />
              {{ t('teams.manage.dangerZone.willDelete.variables') }}
            </li>
            <li class="flex items-start gap-2">
              <XCircle class="h-3 w-3 text-destructive mt-0.5 shrink-0" />
              {{ t('teams.manage.dangerZone.willDelete.history') }}
            </li>
            <li class="flex items-start gap-2">
              <XCircle class="h-3 w-3 text-destructive mt-0.5 shrink-0" />
              {{ t('teams.manage.dangerZone.willDelete.members') }}
            </li>
          </ul>
        </div>
      </div>

      <template v-if="canDeleteTeam" #footer-actions>
        <Button
          variant="destructive"
          @click="showDeleteDialog = true"
          class="gap-2"
        >
          <Trash2 class="h-4 w-4" />
          {{ t('teams.manage.dangerZone.deleteButton') }}
        </Button>
      </template>
    </DsCard>

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
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                  {{ t('teams.manage.deleteDialog.consequencesList.servers') }}
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                  {{ t('teams.manage.deleteDialog.consequencesList.credentials') }}
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                  {{ t('teams.manage.deleteDialog.consequencesList.variables') }}
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 shrink-0" />
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
            :disabled="isDeleting"
            class="gap-2"
          >
            <Spinner v-if="isDeleting" class="mr-2" />
            <Trash2 v-else class="h-4 w-4" />
            {{ t('teams.manage.deleteDialog.confirm') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
