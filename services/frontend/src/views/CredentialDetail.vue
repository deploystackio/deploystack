<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowLeft, Key, Shield, Calendar, User, AlertTriangle, Trash2, Settings, Edit } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { CredentialsService } from '@/services/credentialsService'
import { TeamService, type Team } from '@/services/teamService'
import { useEventBus } from '@/composables/useEventBus'
import type { CloudCredential } from '@/types/credentials'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const eventBus = useEventBus()

const credential = ref<CloudCredential | null>(null)
const selectedTeam = ref<Team | null>(null)
const userRole = ref<string | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const showDeleteModal = ref(false)
const isDeleting = ref(false)
const deleteError = ref<string | null>(null)

const credentialId = route.params.id as string

// Find which team owns the credential by trying each team
async function findCredentialTeam(): Promise<void> {
  try {
    isLoading.value = true
    error.value = null

    const userTeams = await TeamService.getUserTeams()

    if (userTeams.length === 0) {
      error.value = 'No teams found for user'
      return
    }

    // Try each team to find the one that owns this credential
    for (const team of userTeams) {
      try {
        const foundCredential = await CredentialsService.getCredential(team.id, credentialId)

        // If we successfully found the credential, this is the correct team
        credential.value = foundCredential
        selectedTeam.value = team
        userRole.value = team.role || 'team_user'
        return

      } catch (err) {
        // If credential not found in this team, continue to next team
        if (err instanceof Error && err.message.includes('not found')) {
          continue
        }
        // If it's a different error (auth, permissions, etc.), re-throw
        throw err
      }
    }

    // If we get here, credential wasn't found in any team
    error.value = 'Credential not found in any of your teams'
    credential.value = null

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    credential.value = null
  } finally {
    isLoading.value = false
  }
}

// Load data on component mount
onMounted(async () => {
  await findCredentialTeam()
})

// Computed properties for display
const isTeamAdmin = computed(() => {
  return userRole.value === 'team_admin' || selectedTeam.value?.is_admin
})

const canViewFields = computed(() => {
  return isTeamAdmin.value
})

const providerBadge = computed(() => {
  if (!credential.value?.provider) return null
  return {
    variant: 'secondary' as const,
    text: credential.value.provider.name
  }
})

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getFieldTypeDisplay = (type: string) => {
  switch (type) {
    case 'text': return t('credentials.detail.values.text')
    case 'password': return t('credentials.detail.values.password')
    case 'textarea': return t('credentials.detail.values.textarea')
    default: return type
  }
}

const goBack = () => {
  router.push('/credentials')
}

// Delete credential functionality
const handleDeleteClick = () => {
  deleteError.value = null
  showDeleteModal.value = true
}

const confirmDelete = async () => {
  if (!selectedTeam.value || !credential.value) return

  try {
    isDeleting.value = true
    deleteError.value = null

    await CredentialsService.deleteCredential(selectedTeam.value.id, credential.value.id)

    // Emit event to notify other components
    eventBus.emit('credential-deleted', {
      credentialId: credential.value.id,
      credentialName: credential.value.name
    })

    // Emit general credentials updated event
    eventBus.emit('credentials-updated')

    // Close modal and navigate back to credentials list with success message
    showDeleteModal.value = false

    // Navigate back with success message in query params
    router.push({
      path: '/credentials',
      query: { deleted: credential.value.name }
    })

  } catch (err) {
    console.error('Error deleting credential:', err)
    deleteError.value = err instanceof Error ? err.message : 'Failed to delete credential. Please try again.'
  } finally {
    isDeleting.value = false
  }
}

const cancelDelete = () => {
  deleteError.value = null
  showDeleteModal.value = false
}

// Placeholder functions for new dropdown actions
const handleEditName = () => {
  console.log('Edit Name clicked - functionality to be implemented')
  // TODO: Implement edit name functionality
}

const handleUpdateSecrets = () => {
  console.log('Update Secrets clicked - functionality to be implemented')
  // TODO: Implement update secrets functionality
}
</script>

<template>
  <DashboardLayout :title="credential ? t('credentials.detail.title') : t('credentials.detail.loading')">
    <div class="space-y-6">
      <!-- Back Button and Edit Credential Dropdown -->
      <div class="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          @click="goBack"
        >
          <ArrowLeft class="h-4 w-4 mr-2" />
          {{ t('credentials.detail.backToCredentials') }}
        </Button>

        <!-- Edit Credential Dropdown (Team Admin Only) -->
        <DropdownMenu v-if="credential && isTeamAdmin">
          <DropdownMenuTrigger asChild>
            <Button variant="outline" :disabled="isDeleting">
              <Settings class="h-4 w-4 mr-2" />
              {{ t('credentials.actions.editCredential') }}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="handleEditName">
              <Edit class="h-4 w-4 mr-2" />
              {{ t('credentials.actions.editName') }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="handleUpdateSecrets">
              <Key class="h-4 w-4 mr-2" />
              {{ t('credentials.actions.updateSecrets') }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="handleDeleteClick" class="text-red-600 focus:text-red-600">
              <Trash2 class="h-4 w-4 mr-2" />
              {{ t('credentials.actions.delete') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('credentials.detail.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('credentials.detail.error', { error }) }}
      </div>

      <!-- Credential Details -->
      <div v-else-if="credential">
        <div class="px-4 sm:px-0">
          <h3 class="text-base/7 font-semibold text-gray-900">{{ t('credentials.detail.credentialInformation') }}</h3>
          <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('credentials.detail.fields.name') }}: {{ credential.name }}</p>
        </div>
        <div class="mt-6 border-t border-gray-100">
          <dl class="divide-y divide-gray-100">
            <!-- Credential Name -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('credentials.detail.fields.name') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="flex items-center gap-2">
                  <Key class="h-4 w-4 text-gray-400" />
                  <span class="font-medium">{{ credential.name }}</span>
                </div>
              </dd>
            </div>

            <!-- Provider -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('credentials.detail.fields.provider') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="flex items-center gap-2">
                  <img
                    :src="`/images/provider/${credential.provider.id}.svg`"
                    :alt="credential.provider.name"
                    class="w-5 h-5"
                    @error="(event) => { (event.target as HTMLImageElement).style.display = 'none' }"
                  />
                  <Badge v-if="providerBadge" :variant="providerBadge.variant">
                    {{ providerBadge.text }}
                  </Badge>
                </div>
              </dd>
            </div>

            <!-- Comment -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('credentials.detail.fields.comment') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                {{ credential.comment || t('credentials.detail.values.noComment') }}
              </dd>
            </div>

            <!-- Credential ID -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('credentials.detail.fields.credentialId') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <span class="font-mono text-xs">{{ credential.id }}</span>
              </dd>
            </div>

            <!-- Field Information (Team Admin Only) -->
            <div v-if="canViewFields && credential.fields" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('credentials.detail.fieldInformation') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(field, fieldKey) in credential.fields"
                    :key="fieldKey"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <Shield class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <span class="truncate font-medium">{{ fieldKey }}</span>
                          <span class="truncate text-xs text-gray-500">
                            {{ t('credentials.detail.fields.fieldType') }}: {{ getFieldTypeDisplay('text') }}
                          </span>
                          <span v-if="field.secret" class="truncate text-xs text-orange-600">
                            {{ t('credentials.detail.fields.fieldSecret') }}: {{ t('credentials.detail.values.yes') }}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div class="ml-4 shrink-0">
                      <Badge
                        :variant="field.hasValue ? 'default' : 'outline'"
                        class="text-xs"
                      >
                        {{ field.hasValue ? t('credentials.detail.values.configured') : t('credentials.detail.values.notConfigured') }}
                      </Badge>
                    </div>
                  </li>
                </ul>
                <div class="mt-3 text-xs text-blue-600 bg-blue-50 p-3 rounded-md">
                  {{ t('credentials.detail.permissions.teamAdminNote') }}
                </div>
              </dd>
            </div>

            <!-- Team User Note -->
            <div v-else-if="!canViewFields" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('credentials.detail.fieldInformation') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="text-xs text-amber-600 bg-amber-50 p-3 rounded-md flex items-start gap-2">
                  <AlertTriangle class="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{{ t('credentials.detail.permissions.teamUserNote') }}</span>
                </div>
              </dd>
            </div>

            <!-- Audit Information -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('credentials.detail.auditInformation') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <Calendar class="h-4 w-4 text-gray-400" />
                    <span class="font-medium">{{ t('credentials.detail.fields.createdAt') }}:</span>
                    <span>{{ formatDate(credential.createdAt) }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <Calendar class="h-4 w-4 text-gray-400" />
                    <span class="font-medium">{{ t('credentials.detail.fields.updatedAt') }}:</span>
                    <span>{{ formatDate(credential.updatedAt) }}</span>
                  </div>
                  <div v-if="credential.createdBy" class="flex items-center gap-2">
                    <User class="h-4 w-4 text-gray-400" />
                    <span class="font-medium">{{ t('credentials.detail.fields.createdBy') }}:</span>
                    <span v-if="typeof credential.createdBy === 'object'">
                      {{ credential.createdBy.username }} ({{ credential.createdBy.email }})
                    </span>
                    <span v-else>{{ credential.createdBy }}</span>
                  </div>
                </div>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Not Found State -->
      <div v-else class="text-center py-12">
        <div class="space-y-4">
          <AlertTriangle class="h-12 w-12 text-gray-400 mx-auto" />
          <h3 class="text-lg font-medium">{{ t('credentials.detail.notFound') }}</h3>
          <Button @click="goBack" variant="outline">
            <ArrowLeft class="h-4 w-4 mr-2" />
            {{ t('credentials.detail.backToCredentials') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <AlertDialog v-model:open="showDeleteModal">
      <AlertDialogContent class="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle class="flex items-center gap-2 text-red-600">
            <AlertTriangle class="h-5 w-5" />
            Delete Credential
          </AlertDialogTitle>
          <AlertDialogDescription class="text-left">
            Are you sure you want to delete the credential "<strong>{{ credential?.name }}</strong>"?
            <br><br>
            <span class="text-red-600 font-medium">This action cannot be undone.</span> The credential will be permanently removed and cannot be restored.
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
            @click="cancelDelete"
            :disabled="isDeleting"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            @click="confirmDelete"
            :disabled="isDeleting"
            class="bg-red-600 hover:bg-red-700"
          >
            <Trash2 v-if="!isDeleting" class="h-4 w-4 mr-2" />
            <div v-else class="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            {{ isDeleting ? 'Deleting...' : 'Delete Credential' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </DashboardLayout>
</template>
