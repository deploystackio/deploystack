<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
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
import { UserService, type User } from '@/services/userService'
import type { SecurityFormData } from './types'

const router = useRouter()
const { t } = useI18n()
const { setBreadcrumbs } = useBreadcrumbs()

const isLoading = ref(true)
const currentUser = ref<User | null>(null)
const isSubmittingSecurity = ref(false)

// Security form values
const securityForm = ref<SecurityFormData>({
  current_password: '',
  new_password: '',
  confirm_password: '',
})

// Initialize user data
async function initializeUserData() {
  try {
    isLoading.value = true
    const userData = await UserService.getCurrentUser()
    currentUser.value = userData
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
  setBreadcrumbs([
    { label: t('userAccount.title'), href: '/user/profile' },
    { label: t('userAccount.navigation.security') }
  ])
  initializeUserData()
})

// Computed properties
const isEmailUser = computed(() => {
  return currentUser.value?.auth_type === 'email_signup'
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

const providerName = computed(() => {
  const authType = currentUser.value?.auth_type
  if (authType === 'github') return t('userAccount.providers.github')
  return t('userAccount.providers.external')
})

const settingsLocation = computed(() => {
  const authType = currentUser.value?.auth_type
  if (authType === 'github') return t('userAccount.settingsLocations.github')
  return t('userAccount.settingsLocations.external')
})

// Redirect non-email users away from security section
watch([() => currentUser.value], () => {
  if (currentUser.value && !canChangePassword.value) {
    // Redirect to profile section if user cannot change password
    router.push('/user/profile')
  }
}, { immediate: true })

// Security form submission
async function handleSecuritySubmit(event: Event) {
  event.preventDefault()
  
  if (isSubmittingSecurity.value) {
    return
  }
  
  // Validate password confirmation
  if (securityForm.value.new_password !== securityForm.value.confirm_password) {
    toast.error(t('userAccount.alerts.error'), {
      description: t('userAccount.errors.passwordsDoNotMatch')
    })
    return
  }
  
  try {
    isSubmittingSecurity.value = true
    
    await UserService.changePassword(
      securityForm.value.current_password,
      securityForm.value.new_password
    )
    
    // Clear the form
    securityForm.value = {
      current_password: '',
      new_password: '',
      confirm_password: '',
    }
    
    toast.success(t('userAccount.alerts.success'), {
      description: t('userAccount.messages.passwordChanged')
    })
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : t('userAccount.errors.passwordChangeFailed')
    toast.error(t('userAccount.alerts.error'), {
      description: errorMessage
    })
  } finally {
    isSubmittingSecurity.value = false
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
          class="flex-1 justify-center"
        >
          <router-link to="/user/profile">
            {{ t('userAccount.navigation.profile') }}
          </router-link>
        </Button>
        <Button
          v-if="canChangePassword"
          as-child
          variant="ghost"
          class="flex-1 justify-center bg-background shadow-sm"
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

          <!-- Security Section -->
          <div v-else class="space-y-6">
            <DsCard v-if="canChangePassword" :title="t('userAccount.security.title')">
              <p class="text-sm text-muted-foreground mb-6">
                {{ t('userAccount.security.description') }}
              </p>
              <form id="security-form" class="space-y-6" @submit="handleSecuritySubmit">
                <div class="space-y-2">
                  <Label for="current_password">{{ t('userAccount.security.form.currentPassword.label') }}</Label>
                  <Input
                    id="current_password"
                    type="password"
                    v-model="securityForm.current_password"
                    class="w-full"
                    :disabled="isSubmittingSecurity"
                    required
                  />
                </div>

                <div class="space-y-2">
                  <Label for="new_password">{{ t('userAccount.security.form.newPassword.label') }}</Label>
                  <Input
                    id="new_password"
                    type="password"
                    v-model="securityForm.new_password"
                    class="w-full"
                    :disabled="isSubmittingSecurity"
                    minlength="8"
                    required
                  />
                  <p class="text-xs text-muted-foreground">{{ t('userAccount.security.form.newPassword.help') }}</p>
                </div>

                <div class="space-y-2">
                  <Label for="confirm_password">{{ t('userAccount.security.form.confirmPassword.label') }}</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    v-model="securityForm.confirm_password"
                    class="w-full"
                    :disabled="isSubmittingSecurity"
                    required
                  />
                </div>
              </form>

              <template #footer-actions>
                <Button
                  type="submit"
                  form="security-form"
                  :disabled="isSubmittingSecurity"
                >
                  <Spinner v-if="isSubmittingSecurity" class="mr-2" />
                  {{ t('userAccount.security.form.changeButton') }}
                </Button>
              </template>
            </DsCard>

            <!-- Message for non-email users -->
            <DsCard v-else :title="t('userAccount.security.unavailable.title')">
              <p class="text-sm text-muted-foreground mb-4">
                {{ t('userAccount.security.unavailable.description') }}
              </p>
              <div class="text-center py-8">
                <p class="text-muted-foreground mb-4">
                  {{ t('userAccount.security.unavailable.message', { authType: authTypeDisplayName }) }}
                </p>
                <p class="text-sm text-muted-foreground">
                  {{ t('userAccount.security.unavailable.help', { provider: providerName, settingsLocation: settingsLocation }) }}
                </p>
              </div>
            </DsCard>
          </div>
        </div>
      </div>
    </div>
  </NavbarLayout>
</template>
