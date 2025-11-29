<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { toast } from 'vue-sonner'
import AccountSidebarNav from '@/components/account/AccountSidebarNav.vue'
import DashboardLayout from '@/components/DashboardLayout.vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserService, type User } from '@/services/userService'
import type { ProfileFormData } from './types'

const { t } = useI18n()
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
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : t('userAccount.errors.unknown')
    toast.error(t('userAccount.alerts.error'), {
      description: errorMessage
    })
  } finally {
    isLoading.value = false
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
</script>

<template>
  <DashboardLayout>
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
            <Card>
              <CardHeader>
                <CardTitle>{{ t('userAccount.profile.title') }}</CardTitle>
                <CardDescription>
                  {{ t('userAccount.profile.description') }}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form class="space-y-6" @submit="handleProfileSubmit">
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

                  <Button
                    type="submit"
                    :disabled="isSubmittingProfile"
                  >
                    <Spinner v-if="isSubmittingProfile" class="mr-2" />
                    {{ t('userAccount.profile.form.saveButton') }}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
