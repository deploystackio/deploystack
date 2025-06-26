<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Save, Trash2, AlertTriangle, Lock } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { TeamService, type Team } from '@/services/teamService'
import { UserService } from '@/services/userService'
import { z } from 'zod'
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

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// State
const team = ref<Team | null>(null)
const isLoading = ref(true)
const isSaving = ref(false)
const isDeleting = ref(false)
const error = ref<string | null>(null)
const saveError = ref<string | null>(null)
const saveSuccess = ref(false)
const showDeleteDialog = ref(false)
const userPermissions = ref<string[]>([])
const currentUser = ref<any>(null)

// Form data
const formData = ref({
  name: '',
  description: ''
})

// Validation schema
const TeamUpdateSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional()
})

// Computed properties
const teamId = computed(() => route.params.id as string)

const isDefaultTeam = computed(() => {
  if (!team.value || !currentUser.value) return false
  // Check if team name matches username pattern (indicating default team)
  return team.value.name === currentUser.value.username ||
         team.value.slug === currentUser.value.username
})

const canEditName = computed(() => {
  return userPermissions.value.includes('teams.edit') &&
         !isDefaultTeam.value &&
         isTeamOwner.value
})

const canEditDescription = computed(() => {
  return userPermissions.value.includes('teams.edit') && isTeamOwner.value
})

const canDeleteTeam = computed(() => {
  return userPermissions.value.includes('teams.delete') &&
         isTeamOwner.value &&
         !isDefaultTeam.value
})

const isTeamOwner = computed(() => {
  return team.value && currentUser.value && team.value.owner_id === currentUser.value.id
})

const hasChanges = computed(() => {
  if (!team.value) return false
  return formData.value.name !== team.value.name ||
         formData.value.description !== (team.value.description || '')
})

// Load team data
const loadTeam = async () => {
  try {
    isLoading.value = true
    error.value = null

    const [teamData, userData] = await Promise.all([
      TeamService.getTeamById(teamId.value),
      UserService.getCurrentUser()
    ])

    team.value = teamData
    currentUser.value = userData

    if (userData?.role?.permissions) {
      userPermissions.value = userData.role.permissions
    }

    // Initialize form data
    formData.value = {
      name: teamData.name,
      description: teamData.description || ''
    }

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load team'
    console.error('Error loading team:', err)
  } finally {
    isLoading.value = false
  }
}

// Save team changes
const saveTeam = async () => {
  try {
    isSaving.value = true
    saveError.value = null
    saveSuccess.value = false

    // Validate form data
    const validatedData = TeamUpdateSchema.parse(formData.value)

    // Prepare update data
    const updateData: Partial<Team> = {}

    if (canEditName.value && validatedData.name !== team.value?.name) {
      updateData.name = validatedData.name
    }

    if (canEditDescription.value && validatedData.description !== team.value?.description) {
      updateData.description = validatedData.description || null
    }

    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      const updatedTeam = await TeamService.updateTeam(teamId.value, updateData)
      team.value = updatedTeam
      saveSuccess.value = true

      // Clear success message after 3 seconds
      setTimeout(() => {
        saveSuccess.value = false
      }, 3000)
    }

  } catch (err) {
    if (err instanceof z.ZodError) {
      saveError.value = err.errors.map(e => e.message).join(', ')
    } else {
      saveError.value = err instanceof Error ? err.message : 'Failed to save team'
    }
    console.error('Error saving team:', err)
  } finally {
    isSaving.value = false
  }
}

// Delete team
const deleteTeam = async () => {
  try {
    isDeleting.value = true
    const teamName = team.value?.name || 'Unknown Team'
    await TeamService.deleteTeam(teamId.value)

    // Redirect to teams list with success message
    router.push({
      path: '/teams',
      query: { deleted: teamName }
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete team'
    console.error('Error deleting team:', err)
  } finally {
    isDeleting.value = false
    showDeleteDialog.value = false
  }
}

// Navigate back to teams list
const goBack = () => {
  router.push('/teams')
}

// Load data on mount
onMounted(() => {
  loadTeam()
})
</script>

<template>
  <DashboardLayout :title="t('teams.manage.title')">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <Button variant="ghost" size="sm" @click="goBack" class="flex items-center gap-2">
            <ArrowLeft class="h-4 w-4" />
            {{ t('teams.manage.backToTeams') }}
          </Button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('teams.manage.loading') }}
      </div>

      <!-- Error State -->
      <Alert v-else-if="error" variant="destructive">
        <AlertTriangle class="h-4 w-4" />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <!-- Team Management Form -->
      <div v-else-if="team" class="space-y-6">
        <!-- Team Info Card -->
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="flex items-center gap-2">
                  {{ team.name }}
                  <Badge v-if="isDefaultTeam" variant="secondary">
                    {{ t('teams.manage.defaultTeam') }}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {{ t('teams.manage.teamId') }}: {{ team.id }}
                </CardDescription>
              </div>
              <div class="text-right text-sm text-muted-foreground">
                <div>{{ t('teams.manage.created') }}: {{ new Date(team.created_at).toLocaleDateString() }}</div>
                <div>{{ t('teams.manage.updated') }}: {{ new Date(team.updated_at).toLocaleDateString() }}</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <!-- Success Message -->
        <Alert v-if="saveSuccess" class="border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{{ t('teams.manage.saveSuccess') }}</AlertDescription>
        </Alert>

        <!-- Save Error -->
        <Alert v-if="saveError" variant="destructive">
          <AlertTriangle class="h-4 w-4" />
          <AlertDescription>{{ saveError }}</AlertDescription>
        </Alert>

        <!-- Edit Form -->
        <Card>
          <CardHeader>
            <CardTitle>{{ t('teams.manage.editTeam') }}</CardTitle>
            <CardDescription>{{ t('teams.manage.editDescription') }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <!-- Team Name -->
            <div class="space-y-2">
              <Label for="name" class="flex items-center gap-2">
                {{ t('teams.manage.fields.name.label') }}
                <Lock v-if="!canEditName" class="h-3 w-3 text-muted-foreground" />
              </Label>
              <Input
                id="name"
                v-model="formData.name"
                :disabled="!canEditName"
                :placeholder="t('teams.manage.fields.name.placeholder')"
                class="max-w-md"
              />
              <p v-if="isDefaultTeam" class="text-xs text-muted-foreground">
                {{ t('teams.manage.fields.name.defaultTeamNote') }}
              </p>
              <p v-else-if="!canEditName" class="text-xs text-muted-foreground">
                {{ t('teams.manage.fields.name.noPermission') }}
              </p>
            </div>

            <!-- Team Description -->
            <div class="space-y-2">
              <Label for="description" class="flex items-center gap-2">
                {{ t('teams.manage.fields.description.label') }}
                <Lock v-if="!canEditDescription" class="h-3 w-3 text-muted-foreground" />
              </Label>
              <textarea
                id="description"
                v-model="formData.description"
                :disabled="!canEditDescription"
                :placeholder="t('teams.manage.fields.description.placeholder')"
                class="flex min-h-[80px] w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                rows="3"
              />
              <p v-if="!canEditDescription" class="text-xs text-muted-foreground">
                {{ t('teams.manage.fields.description.noPermission') }}
              </p>
            </div>

            <!-- Save Button -->
            <div class="flex items-center gap-2 pt-4">
              <Button
                @click="saveTeam"
                :disabled="!hasChanges || isSaving || (!canEditName && !canEditDescription)"
                class="flex items-center gap-2"
              >
                <Save class="h-4 w-4" />
                {{ isSaving ? t('teams.manage.saving') : t('teams.manage.save') }}
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- Danger Zone -->
        <Card v-if="canDeleteTeam" class="border-red-200">
          <CardHeader>
            <CardTitle class="text-red-600">{{ t('teams.manage.dangerZone.title') }}</CardTitle>
            <CardDescription>{{ t('teams.manage.dangerZone.description') }}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              @click="showDeleteDialog = true"
              class="flex items-center gap-2"
            >
              <Trash2 class="h-4 w-4" />
              {{ t('teams.manage.dangerZone.deleteButton') }}
            </Button>
          </CardContent>
        </Card>
      </div>

      <!-- Delete Confirmation Dialog -->
      <AlertDialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle class="flex items-center gap-2 text-red-600">
              <AlertTriangle class="h-5 w-5" />
              {{ t('teams.manage.deleteDialog.title') }}
            </AlertDialogTitle>
            <AlertDialogDescription class="space-y-2">
              <p>{{ t('teams.manage.deleteDialog.warning') }}</p>
              <p class="font-medium">{{ t('teams.manage.deleteDialog.teamName') }}: "{{ team?.name }}"</p>
              <div class="bg-red-50 p-3 rounded-md">
                <p class="text-sm text-red-800">{{ t('teams.manage.deleteDialog.consequences') }}</p>
                <ul class="text-xs text-red-700 mt-2 space-y-1">
                  <li>• {{ t('teams.manage.deleteDialog.consequencesList.servers') }}</li>
                  <li>• {{ t('teams.manage.deleteDialog.consequencesList.credentials') }}</li>
                  <li>• {{ t('teams.manage.deleteDialog.consequencesList.variables') }}</li>
                  <li>• {{ t('teams.manage.deleteDialog.consequencesList.history') }}</li>
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
              class="bg-red-600 hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 class="h-4 w-4" />
              {{ isDeleting ? t('teams.manage.deleteDialog.deleting') : t('teams.manage.deleteDialog.confirm') }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </DashboardLayout>
</template>
