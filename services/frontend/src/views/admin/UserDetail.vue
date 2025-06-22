<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Mail, Github, Shield } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import UserActionsGroup from '@/components/admin/UserActionsGroup.vue'
import { getEnv } from '@/utils/env'
import type { User } from './users/types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const user = ref<User | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''
const userId = route.params.id as string

// Fetch user details from API
async function fetchUser(id: string): Promise<User> {
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

// Load user on component mount
onMounted(async () => {
  try {
    isLoading.value = true
    user.value = await fetchUser(userId)
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    user.value = null
  } finally {
    isLoading.value = false
  }
})

// Computed properties for display
const displayName = computed(() => {
  if (!user.value) return ''
  const firstName = user.value.first_name || ''
  const lastName = user.value.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || user.value.username
})

const authTypeBadge = computed(() => {
  if (!user.value) return null
  const isEmail = user.value.auth_type === 'email_signup'
  return {
    variant: (isEmail ? 'default' : 'secondary') as 'default' | 'secondary',
    icon: isEmail ? Mail : Github,
    text: isEmail ? t('adminUsers.userDetail.values.email') : t('adminUsers.userDetail.values.github')
  }
})

const goBack = () => {
  router.push('/admin/users')
}
</script>

<template>
  <DashboardLayout :title="user ? t('adminUsers.userDetail.title', { username: user.username }) : t('adminUsers.userDetail.titleLoading')">
    <div class="space-y-6">
      <!-- Back Button -->
      <div>
        <Button 
          variant="outline" 
          @click="goBack"
          class="mb-4"
        >
          <ArrowLeft class="h-4 w-4 mr-2" />
          {{ t('adminUsers.userDetail.backToUsers') }}
        </Button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('adminUsers.userDetail.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('adminUsers.userDetail.errorLoading', { error }) }}
      </div>

      <!-- User Details -->
      <div v-else-if="user">
        <!-- User Actions Group -->
        <UserActionsGroup :user="user" />

        <div class="px-4 sm:px-0">
          <h3 class="text-base/7 font-semibold text-gray-900">{{ t('adminUsers.userDetail.userInformation') }}</h3>
          <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('adminUsers.userDetail.personalDetails') }}</p>
        </div>
        <div class="mt-6 border-t border-gray-100">
          <dl class="divide-y divide-gray-100">
            <!-- Full Name -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.fullName') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                {{ displayName === user.username ? t('adminUsers.userDetail.values.notProvided') : displayName }}
              </dd>
            </div>

            <!-- Username -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.username') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">{{ user.username }}</dd>
            </div>

            <!-- Email -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.emailAddress') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">{{ user.email }}</dd>
            </div>

            <!-- Role -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.role') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                {{ user.role ? user.role.name : t('adminUsers.userDetail.values.noRoleAssigned') }}
              </dd>
            </div>

            <!-- Registration Method -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.registrationMethod') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <Badge 
                  v-if="authTypeBadge"
                  :variant="authTypeBadge.variant"
                  class="flex items-center gap-1 w-fit"
                >
                  <component :is="authTypeBadge.icon" class="h-3 w-3" />
                  {{ authTypeBadge.text }}
                </Badge>
              </dd>
            </div>

            <!-- GitHub ID (if applicable) -->
            <div v-if="user.github_id" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.githubId') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <span class="font-mono">{{ user.github_id }}</span>
              </dd>
            </div>

            <!-- User Details -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.accountDetails') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div><span class="font-medium">{{ t('adminUsers.userDetail.values.firstName') }}</span> {{ user.first_name || t('adminUsers.userDetail.values.notProvided') }}</div>
                  <div><span class="font-medium">{{ t('adminUsers.userDetail.values.lastName') }}</span> {{ user.last_name || t('adminUsers.userDetail.values.notProvided') }}</div>
                  <div><span class="font-medium">{{ t('adminUsers.userDetail.values.userId') }}</span> <span class="font-mono text-xs">{{ user.id }}</span></div>
                </div>
              </dd>
            </div>

            <!-- Permissions (if role exists) -->
            <div v-if="user.role && user.role.permissions.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.permissions') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li 
                    v-for="permission in user.role.permissions" 
                    :key="permission"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <Shield class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <span class="truncate font-medium">{{ permission }}</span>
                      </div>
                    </div>
                    <div class="ml-4 shrink-0">
                      <Badge variant="outline" class="text-xs">{{ t('adminUsers.userDetail.values.active') }}</Badge>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
