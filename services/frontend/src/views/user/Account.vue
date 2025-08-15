<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import AccountSidebarNav from '@/components/account/AccountSidebarNav.vue'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { getEnv } from '@/utils/env'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle2Icon, XIcon } from 'lucide-vue-next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const route = useRoute()

const isLoading = ref(true)
const error = ref<string | null>(null)
const showSuccessAlert = ref(false)
const successAlertMessage = ref('')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const currentUser = ref<any>(null)

const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''

// Profile form values
const profileForm = ref({
  first_name: '',
  last_name: '',
  username: '',
  email: '',
})

// Security form values
const securityForm = ref({
  current_password: '',
  new_password: '',
  confirm_password: '',
})

// Get current user data
async function fetchCurrentUser() {
  if (!apiUrl) {
    throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured.')
  }
  
  const response = await fetch(`${apiUrl}/api/users/me`, { credentials: 'include' })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch user data: ${response.statusText} (status: ${response.status})`)
  }
  
  return await response.json()
}

onMounted(async () => {
  try {
    isLoading.value = true
    const userData = await fetchCurrentUser()
    currentUser.value = userData
    
    // Initialize profile form with current user data
    profileForm.value = {
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      username: userData.username || '',
      email: userData.email || '',
    }
    
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
  } finally {
    isLoading.value = false
  }
})

const currentSection = computed(() => {
  const section = route.params.section as string | undefined
  return section || 'profile'
})

const isEmailUser = computed(() => {
  return currentUser.value?.auth_type === 'email_signup'
})

const canChangeUsername = computed(() => {
  return isEmailUser.value
})

const canChangePassword = computed(() => {
  return isEmailUser.value
})

// Watch for route changes and reset success alert
watch(() => route.params.section, () => {
  showSuccessAlert.value = false
  // Reset security form when switching sections
  if (currentSection.value === 'security') {
    securityForm.value = {
      current_password: '',
      new_password: '',
      confirm_password: '',
    }
  }
})

// Redirect non-email users away from security section
watch([() => currentSection.value, () => currentUser.value], () => {
  if (currentSection.value === 'security' && currentUser.value && !canChangePassword.value) {
    // Redirect to profile section if user cannot change password
    window.location.href = '/user/account/profile'
  }
}, { immediate: true })

// Profile form submission
async function handleProfileSubmit(event: Event) {
  event.preventDefault()
  
  try {
    if (!apiUrl) {
      throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured for updating profile.')
    }
    
    if (!currentUser.value?.id) {
      throw new Error('User ID not available')
    }
    
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
    
    const response = await fetch(`${apiUrl}/api/users/${currentUser.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(formData),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to update profile: ${response.statusText} (status: ${response.status})`)
    }
    
    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update profile due to an API error.')
    }
    
    // Update current user data
    currentUser.value = result.user
    
    successAlertMessage.value = 'Profile updated successfully'
    showSuccessAlert.value = true
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update profile'
  }
}

// Security form submission
async function handleSecuritySubmit(event: Event) {
  event.preventDefault()
  
  // Validate password confirmation
  if (securityForm.value.new_password !== securityForm.value.confirm_password) {
    error.value = 'New passwords do not match'
    return
  }
  
  try {
    if (!apiUrl) {
      throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured for changing password.')
    }
    
    const response = await fetch(`${apiUrl}/api/auth/email/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        current_password: securityForm.value.current_password,
        new_password: securityForm.value.new_password,
      }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to change password: ${response.statusText} (status: ${response.status})`)
    }
    
    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to change password due to an API error.')
    }
    
    // Clear the form
    securityForm.value = {
      current_password: '',
      new_password: '',
      confirm_password: '',
    }
    
    successAlertMessage.value = 'Password changed successfully'
    showSuccessAlert.value = true
    error.value = null
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to change password'
  }
}
</script>

<template>
  <DashboardLayout title="Account Settings">
    <div class="hidden space-y-6 pb-16 md:block">
      <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside class="lg:w-1/5">
          <AccountSidebarNav :can-change-password="canChangePassword" />
        </aside>
        <div class="flex-1 lg:max-w-3xl">
          <Alert v-if="showSuccessAlert" variant="default" class="mb-8 border-green-500 bg-green-50 text-green-700 relative">
            <CheckCircle2Icon class="h-5 w-5 text-green-600" />
            <AlertTitle class="font-semibold text-green-800">Success</AlertTitle>
            <AlertDescription>
              {{ successAlertMessage }}
            </AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              class="absolute top-2 right-2 p-1 h-auto text-green-700 hover:bg-green-100"
              @click="showSuccessAlert = false"
              aria-label="Dismiss success alert"
            >
              <XIcon class="h-4 w-4" />
            </Button>
          </Alert>

          <div v-if="isLoading" class="text-muted-foreground">Loading account settings...</div>
          <div v-else-if="error" class="text-red-500">Error: {{ error }}</div>

          <!-- Profile Section -->
          <div v-else-if="currentSection === 'profile'" class="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle class="text-xl">Profile Information</CardTitle>
                <CardDescription>
                  Update your personal information and email address.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form class="space-y-6" @submit="handleProfileSubmit">
                  <div class="space-y-2">
                    <Label for="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      type="text"
                      v-model="profileForm.first_name"
                      class="w-full"
                    />
                  </div>

                  <div class="space-y-2">
                    <Label for="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      type="text"
                      v-model="profileForm.last_name"
                      class="w-full"
                    />
                  </div>

                  <div class="space-y-2">
                    <Label for="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      v-model="profileForm.username"
                      class="w-full"
                      :disabled="!canChangeUsername"
                    />
                    <p v-if="!canChangeUsername" class="text-xs text-muted-foreground">
                      Username cannot be changed for {{ currentUser?.auth_type === 'github' ? 'GitHub' : 'external' }} authentication.
                    </p>
                  </div>

                  <div class="space-y-2">
                    <Label for="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      v-model="profileForm.email"
                      class="w-full"
                    />
                  </div>

                  <Button type="submit">
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <!-- Security Section -->
          <div v-else-if="currentSection === 'security'" class="space-y-6">
            <Card v-if="canChangePassword">
              <CardHeader>
                <CardTitle class="text-xl">Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form class="space-y-6" @submit="handleSecuritySubmit">
                  <div class="space-y-2">
                    <Label for="current_password">Current Password</Label>
                    <Input
                      id="current_password"
                      type="password"
                      v-model="securityForm.current_password"
                      class="w-full"
                      required
                    />
                  </div>

                  <div class="space-y-2">
                    <Label for="new_password">New Password</Label>
                    <Input
                      id="new_password"
                      type="password"
                      v-model="securityForm.new_password"
                      class="w-full"
                      minlength="8"
                      required
                    />
                    <p class="text-xs text-muted-foreground">Password must be at least 8 characters long.</p>
                  </div>

                  <div class="space-y-2">
                    <Label for="confirm_password">Confirm New Password</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      v-model="securityForm.confirm_password"
                      class="w-full"
                      required
                    />
                  </div>

                  <Button type="submit">
                    Change Password
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            <!-- Message for non-email users -->
            <Card v-else>
              <CardHeader>
                <CardTitle class="text-xl">Password Management</CardTitle>
                <CardDescription>
                  Password management for your account type.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div class="text-center py-8">
                  <p class="text-muted-foreground mb-4">
                    Password changes are not available for {{ currentUser?.auth_type === 'github' ? 'GitHub' : 'external' }} authentication.
                  </p>
                  <p class="text-sm text-muted-foreground">
                    Your account is secured through {{ currentUser?.auth_type === 'github' ? 'GitHub' : 'your external provider' }}.
                    To change your password, please visit your {{ currentUser?.auth_type === 'github' ? 'GitHub account settings' : 'authentication provider' }}.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div v-else>
            <p class="text-muted-foreground">Section not found.</p>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
