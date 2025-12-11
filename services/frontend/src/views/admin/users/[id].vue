<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { SettingsMenu, SettingsMenuGroup, SettingsMenuItem } from '@/components/ui/settings-menu'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { getEnv } from '@/utils/env'
import { UserService } from '@/services/userService'
import UserDetailGeneral from './components/UserDetailGeneral.vue'
import UserDetailTeams from './components/UserDetailTeams.vue'
import type { User as UserType } from './types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const user = ref<UserType | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''
const userId = route.params.id as string

// Current section from query params (default to 'general')
const currentSection = computed(() => {
  const section = route.query.section as string
  return section === 'teams' ? 'teams' : 'general'
})

// Navigation menu items
const menuItems = [
  { id: 'general', label: 'General' },
  { id: 'teams', label: 'Teams' }
]

// Password reset functionality
const isResetLoading = ref(false)

const canResetPassword = computed(() => {
  return user.value?.auth_type === 'email_signup'
})

const handlePasswordReset = async () => {
  if (!user.value) return

  try {
    isResetLoading.value = true
    const result = await UserService.adminResetPassword(user.value.email)

    if (result.success) {
      toast.success(t('adminUsers.userDetail.actions.resetPasswordSuccess', {
        email: user.value.email
      }))
    }
  } catch (error) {
    const errorKey = 'adminUsers.userDetail.actions.resetPasswordError'
    let errorText = error instanceof Error ? error.message : 'Unknown error'

    if (error instanceof Error) {
      switch (error.message) {
        case 'INVALID_USER':
          errorText = 'User not found or not eligible for password reset'
          break
        case 'UNAUTHORIZED':
          errorText = 'You are not authorized to perform this action'
          break
        case 'FORBIDDEN':
          errorText = 'This action is forbidden'
          break
        case 'SERVICE_UNAVAILABLE':
          errorText = 'Email service is currently unavailable'
          break
      }
    }

    toast.error(t(errorKey, { error: errorText }))
  } finally {
    isResetLoading.value = false
  }
}

// Navigate to a section
function navigateToSection(sectionId: string) {
  router.push({
    path: route.path,
    query: { section: sectionId }
  })
}

// Fetch user details from API
async function fetchUser(id: string): Promise<UserType> {
  if (!apiUrl) {
    throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured.')
  }

  const response = await fetch(`${apiUrl}/api/users/${id}`, {
    credentials: 'include'
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch user: ${response.statusText} (status: ${response.status})`)
  }

  return await response.json()
}

// Computed properties for display
const displayName = computed(() => {
  if (!user.value) return ''
  const firstName = user.value.first_name || ''
  const lastName = user.value.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || user.value.username
})

// Load user on component mount
onMounted(async () => {
  setBreadcrumbs([
    { label: t('adminUsers.title'), href: '/admin/users' },
    { label: t('adminUsers.userDetail.titleLoading') }
  ])

  try {
    isLoading.value = true
    user.value = await fetchUser(userId)
    error.value = null

    // Update breadcrumbs with username
    setBreadcrumbs([
      { label: t('adminUsers.title'), href: '/admin/users' },
      { label: user.value.username }
    ])
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    user.value = null
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <NavbarLayout>
    <!-- Header with breadcrumbs and actions -->
    <DsPageHeading v-if="user" :title="displayName">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/users">
              {{ t('adminUsers.title') }}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{{ user.username }}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <template #actions>
        <AlertDialog>
          <AlertDialogTrigger as-child>
            <Button
              variant="outline"
              :disabled="!canResetPassword || isResetLoading"
              :title="!canResetPassword ? t('adminUsers.userDetail.actions.resetPasswordDisabled') : undefined"
            >
              <Spinner v-if="isResetLoading" class="mr-2" />
              {{ t('adminUsers.userDetail.actions.forceResetPassword') }}
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {{ t('adminUsers.userDetail.actions.resetPasswordConfirm.title') }}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {{ t('adminUsers.userDetail.actions.resetPasswordConfirm.description', {
                  username: user.username
                }) }}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>
                {{ t('adminUsers.userDetail.actions.resetPasswordConfirm.cancel') }}
              </AlertDialogCancel>
              <AlertDialogAction as-child>
                <Button
                  @click="handlePasswordReset"
                  :disabled="isResetLoading"
                >
                  <Spinner v-if="isResetLoading" class="mr-2" />
                  {{ t('adminUsers.userDetail.actions.resetPasswordConfirm.confirm') }}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </template>
    </DsPageHeading>

    <DsPageHeading v-else-if="isLoading" :title="t('adminUsers.userDetail.titleLoading')" />

    <div class="space-y-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('adminUsers.userDetail.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('adminUsers.userDetail.errorLoading', { error }) }}
      </div>

      <!-- User Details with Settings Menu Layout -->
      <div v-else-if="user" class="flex flex-col space-y-8 md:flex-row md:space-x-12 md:space-y-0">
        <!-- Desktop Sidebar Navigation -->
        <aside class="hidden md:block w-56 shrink-0">
          <SettingsMenu>
            <SettingsMenuGroup>
              <SettingsMenuItem
                v-for="item in menuItems"
                :key="item.id"
                :to="`/admin/users/${userId}?section=${item.id}`"
                :active="currentSection === item.id"
              >
                {{ item.label }}
              </SettingsMenuItem>
            </SettingsMenuGroup>
          </SettingsMenu>
        </aside>

        <!-- Mobile Navigation -->
        <div class="block md:hidden">
          <nav class="flex space-x-1 p-1 bg-muted/50 rounded-lg">
            <button
              v-for="item in menuItems"
              :key="item.id"
              @click="navigateToSection(item.id)"
              class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors"
              :class="currentSection === item.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'"
            >
              {{ item.label }}
            </button>
          </nav>
        </div>

        <!-- Content Area -->
        <div class="flex-1">
          <UserDetailGeneral v-if="currentSection === 'general'" :user="user" />
          <UserDetailTeams v-else-if="currentSection === 'teams'" :user-id="userId" />
        </div>
      </div>
    </div>
  </NavbarLayout>
</template>
