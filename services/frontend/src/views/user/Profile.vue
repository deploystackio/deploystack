<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { toast } from 'vue-sonner'
import AccountSidebarNav from '@/components/account/AccountSidebarNav.vue'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { DsCard } from '@/components/ui/ds-card'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, XCircle, Trash2 } from 'lucide-vue-next'
import { UserService, type User } from '@/services/userService'
import { TeamService, type Team } from '@/services/teamService'
import type { ProfileFormData } from './types'

const { t } = useI18n()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const isLoading = ref(true)
const currentUser = ref<User | null>(null)
const isSubmittingProfile = ref(false)

// Profile form values
const profileForm = ref<ProfileFormData>({
  first_name: '',
  last_name: '',
  username: '',
  email: '',
})

// Delete account state
const userTeams = ref<Team[]>([])
const isCheckingTeams = ref(false)
const showDeleteDialog = ref(false)
const isDeletingAccount = ref(false)
const deleteConfirmationText = ref('')

// Initialize user data
async function initializeUserData() {
  try {
    isLoading.value = true
    const userData = await UserService.getCurrentUser()
    currentUser.value = userData

    if (userData) {
      // Initialize profile form with current user data
      profileForm.value = {
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        username: userData.username || '',
        email: userData.email || '',
      }
    }

    // Load user teams for delete account check
    await loadUserTeams()
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : t('userAccount.errors.unknown')
    toast.error(t('userAccount.alerts.error'), {
      description: errorMessage
    })
  } finally {
    isLoading.value = false
  }
}

// Load user teams
async function loadUserTeams() {
  try {
    isCheckingTeams.value = true
    userTeams.value = await TeamService.getUserTeams()
  } catch (err) {
    console.error('Error loading user teams:', err)
  } finally {
    isCheckingTeams.value = false
  }
}

onMounted(() => {
  setBreadcrumbs([{ label: t('userAccount.title') }])
  initializeUserData()
})

// Computed properties
const isEmailUser = computed(() => {
  return currentUser.value?.auth_type === 'email_signup'
})

const canChangeUsername = computed(() => {
  return isEmailUser.value
})

const canChangePassword = computed(() => {
  return isEmailUser.value
})

// Dynamic auth type display names
const authTypeDisplayName = computed(() => {
  const authType = currentUser.value?.auth_type
  if (!authType) return ''
  return t(`userAccount.authTypes.${authType}`)
})

// Check if user owns non-default teams
const nonDefaultOwnedTeams = computed(() => {
  return userTeams.value.filter(team => team.is_owner && !team.is_default)
})

const canDeleteAccount = computed(() => {
  return nonDefaultOwnedTeams.value.length === 0
})

// Check if delete button can be enabled
const isDeleteConfirmationValid = computed(() => {
  return deleteConfirmationText.value === 'sudo delete account'
})

// Profile form submission
async function handleProfileSubmit(event: Event) {
  event.preventDefault()

  if (!currentUser.value?.id || isSubmittingProfile.value) {
    return
  }

  try {
    isSubmittingProfile.value = true

    // Prepare form data, only including allowed fields
    const formData: Record<string, string> = {
      first_name: profileForm.value.first_name,
      last_name: profileForm.value.last_name,
      email: profileForm.value.email,
    }

    // Only include username if user can change it
    if (canChangeUsername.value) {
      formData.username = profileForm.value.username
    }

    const result = await UserService.updateProfile(currentUser.value.id, formData)

    // Update current user data
    currentUser.value = result.user

    toast.success(t('userAccount.alerts.success'), {
      description: t('userAccount.messages.profileUpdated')
    })

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : t('userAccount.errors.profileUpdateFailed')
    toast.error(t('userAccount.alerts.error'), {
      description: errorMessage
    })
  } finally {
    isSubmittingProfile.value = false
  }
}

// Handle delete account button click
function handleDeleteAccountClick() {
  if (!canDeleteAccount.value) {
    return
  }

  deleteConfirmationText.value = ''
  showDeleteDialog.value = true
}

// Delete account
async function deleteAccount() {
  try {
    isDeletingAccount.value = true

    const result = await UserService.deleteMyAccount()

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete account')
    }

    // Show success toast
    toast.success('Account Deleted', {
      description: 'Your account has been successfully deleted. You will be logged out.'
    })

    // Wait a moment for toast to show
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Clear user data and redirect to logout
    await UserService.logout()
    router.push('/logout')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete account'
    toast.error('Error', {
      description: errorMessage
    })
  } finally {
    isDeletingAccount.value = false
    showDeleteDialog.value = false
  }
}
</script>

<template>
  <NavbarLayout>
    <DsPageHeading :title="t('userAccount.title')" />

    <!-- Mobile Navigation - Show tabs on small screens -->
    <div class="block md:hidden mb-6">
      <nav class="flex space-x-1 p-1 bg-muted/50 rounded-lg">
        <Button
          as-child
          variant="ghost"
          class="flex-1 justify-center bg-background shadow-sm"
        >
          <router-link to="/user/profile">
            {{ t('userAccount.navigation.profile') }}
          </router-link>
        </Button>
        <Button
          v-if="canChangePassword"
          as-child
          variant="ghost"
          class="flex-1 justify-center"
        >
          <router-link to="/user/security">
            {{ t('userAccount.navigation.security') }}
          </router-link>
        </Button>
      </nav>
    </div>

    <!-- Main Content -->
    <div class="space-y-6 pb-16">
      <div class="flex flex-col space-y-8 md:flex-row md:space-x-12 md:space-y-0">
        <!-- Desktop Sidebar Navigation -->
        <aside class="hidden md:block md:w-1/5">
          <AccountSidebarNav :can-change-password="canChangePassword" />
        </aside>

        <!-- Content Area -->
        <div class="flex-1">
          <!-- Loading State -->
          <div v-if="isLoading" class="text-muted-foreground py-8 text-center">
            {{ t('userAccount.messages.loading') }}
          </div>

          <!-- Profile Section -->
          <div v-else class="space-y-6">
            <DsCard :title="t('userAccount.profile.title')">
              <p class="text-sm text-muted-foreground mb-6">
                {{ t('userAccount.profile.description') }}
              </p>
              <form id="profile-form" class="space-y-6" @submit="handleProfileSubmit">
                <div class="space-y-2">
                  <Label for="first_name">{{ t('userAccount.profile.form.firstName.label') }}</Label>
                  <Input
                    id="first_name"
                    type="text"
                    v-model="profileForm.first_name"
                    class="w-full"
                    :disabled="isSubmittingProfile"
                  />
                </div>

                <div class="space-y-2">
                  <Label for="last_name">{{ t('userAccount.profile.form.lastName.label') }}</Label>
                  <Input
                    id="last_name"
                    type="text"
                    v-model="profileForm.last_name"
                    class="w-full"
                    :disabled="isSubmittingProfile"
                  />
                </div>

                <div class="space-y-2">
                  <Label for="username">{{ t('userAccount.profile.form.username.label') }}</Label>
                  <Input
                    id="username"
                    type="text"
                    v-model="profileForm.username"
                    class="w-full"
                    :disabled="!canChangeUsername || isSubmittingProfile"
                  />
                  <p v-if="!canChangeUsername" class="text-xs text-muted-foreground">
                    {{ t('userAccount.profile.form.username.disabledHelp', { authType: authTypeDisplayName }) }}
                  </p>
                </div>

                <div class="space-y-2">
                  <Label for="email">{{ t('userAccount.profile.form.email.label') }}</Label>
                  <Input
                    id="email"
                    type="email"
                    v-model="profileForm.email"
                    class="w-full"
                    :disabled="isSubmittingProfile"
                  />
                </div>
              </form>

              <template #footer-actions>
                <Button
                  type="submit"
                  form="profile-form"
                  :disabled="isSubmittingProfile"
                >
                  <Spinner v-if="isSubmittingProfile" class="mr-2" />
                  {{ t('userAccount.profile.form.saveButton') }}
                </Button>
              </template>
            </DsCard>

            <!-- Delete Account Card -->
            <DsCard title="Delete Account">
              <p class="text-sm text-muted-foreground mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>

              <!-- Cannot delete - owns non-default teams -->
              <Alert v-if="!canDeleteAccount" variant="destructive" class="mb-4">
                <AlertTriangle class="h-4 w-4" />
                <AlertDescription class="text-foreground">
                  <p class="font-medium mb-2 text-foreground">Cannot delete account</p>
                  <p class="text-sm text-foreground">
                    You own {{ nonDefaultOwnedTeams.length }} non-default team(s). Please delete or transfer ownership of these teams before deleting your account:
                  </p>
                  <ul class="text-sm mt-2 space-y-1 text-foreground">
                    <li v-for="team in nonDefaultOwnedTeams" :key="team.id" class="flex items-center gap-2">
                      <XCircle class="h-3 w-3" />
                      {{ team.name }}
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>

              <!-- Can delete -->
              <div v-else class="space-y-4">
                <h4 class="text-sm font-medium mb-2">What will be deleted:</h4>
                <ul class="text-xs space-y-1.5 mb-4">
                  <li class="flex items-start gap-2">
                    <XCircle class="h-3 w-3 mt-0.5 flex-shrink-0" />
                    Your user account and all personal information
                  </li>
                  <li class="flex items-start gap-2">
                    <XCircle class="h-3 w-3 mt-0.5 flex-shrink-0" />
                    Your default team and all MCP server installations
                  </li>
                  <li class="flex items-start gap-2">
                    <XCircle class="h-3 w-3 mt-0.5 flex-shrink-0" />
                    All team memberships (you will be removed from other teams)
                  </li>
                  <li class="flex items-start gap-2">
                    <XCircle class="h-3 w-3 mt-0.5 flex-shrink-0" />
                    All user preferences and configurations
                  </li>
                  <li class="flex items-start gap-2">
                    <XCircle class="h-3 w-3 mt-0.5 flex-shrink-0" />
                    All active sessions (you will be logged out)
                  </li>
                </ul>

                <Alert class="border-amber-200 bg-amber-50">
                  <AlertTriangle class="h-4 w-4 text-amber-600" />
                  <AlertDescription class="text-amber-800">
                    <p class="font-medium text-sm mb-1">This action is irreversible</p>
                    <p class="text-xs">Once deleted, your account and all data cannot be recovered.</p>
                  </AlertDescription>
                </Alert>
              </div>

              <template #footer-actions>
                <Button
                  variant="destructive"
                  :disabled="!canDeleteAccount || isCheckingTeams"
                  @click="handleDeleteAccountClick"
                >
                  Delete Account
                </Button>
              </template>
            </DsCard>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Account Confirmation Dialog -->
    <AlertDialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
      <AlertDialogContent class="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle class="flex items-center gap-2 text-destructive">
            <AlertTriangle class="h-5 w-5" />
            Delete Account
          </AlertDialogTitle>
          <AlertDialogDescription class="space-y-4">
            <p>This will permanently delete your account and all associated data. This action cannot be undone.</p>

            <div class="rounded-lg border-destructive/50 bg-destructive/5 p-4 space-y-3">
              <p class="text-sm font-medium text-destructive">All of the following will be permanently deleted:</p>
              <ul class="text-xs space-y-2">
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  Your account ({{ currentUser?.email }})
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  Your default team and all MCP installations
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  All team memberships
                </li>
                <li class="flex items-start gap-2">
                  <XCircle class="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                  All preferences and configurations
                </li>
              </ul>
            </div>

            <div class="space-y-2">
              <Label for="delete-confirmation" class="text-sm font-medium">
                To confirm, type <span class="font-mono text-destructive">sudo delete account</span>
              </Label>
              <Input
                id="delete-confirmation"
                v-model="deleteConfirmationText"
                placeholder="sudo delete account"
                class="font-mono"
                :disabled="isDeletingAccount"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="showDeleteDialog = false" :disabled="isDeletingAccount">
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            @click="deleteAccount"
            :disabled="!isDeleteConfirmationValid || isDeletingAccount"
            class="bg-destructive hover:bg-destructive/90 gap-2"
          >
            <Spinner v-if="isDeletingAccount" class="mr-2" />
            <Trash2 v-else class="h-4 w-4" />
            Delete Account
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </NavbarLayout>
</template>
