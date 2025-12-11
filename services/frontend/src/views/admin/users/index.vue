<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { Input } from '@/components/ui/input'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { getEnv } from '@/utils/env'
import UserTableColumns from './UserTableColumns.vue'
import type { User, UsersApiResponse } from './types'

const { t } = useI18n()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const users = ref<User[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''

// Filter users based on search query
const filteredUsers = computed(() => {
  if (!searchQuery.value) {
    return users.value
  }
  const query = searchQuery.value.toLowerCase()
  return users.value.filter(user => {
    const firstName = user.first_name || ''
    const lastName = user.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()
    const displayName = fullName || user.username

    return displayName.toLowerCase().includes(query) ||
           user.email.toLowerCase().includes(query) ||
           user.username.toLowerCase().includes(query) ||
           (user.role && user.role.name.toLowerCase().includes(query))
  })
})

// Navigation function for viewing user details
const handleViewUser = (userId: string) => {
  router.push(`/admin/users/${userId}`)
}

// Fetch users from API
async function fetchUsers(): Promise<User[]> {
  if (!apiUrl) {
    throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured.')
  }

  const response = await fetch(`${apiUrl}/api/users`, {
    credentials: 'include'
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch users: ${response.statusText} (status: ${response.status})`)
  }

  const result: UsersApiResponse = await response.json()
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('API response for users was not successful or data format is incorrect.')
  }

  return result.data
}

// Load users on component mount
onMounted(async () => {
  setBreadcrumbs([{ label: t('adminUsers.title') }])

  try {
    isLoading.value = true
    users.value = await fetchUsers()
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    users.value = []
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <NavbarLayout>
    <DsPageHeading :title="t('adminUsers.title')" />

    <div class="space-y-6">

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('adminUsers.table.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('adminUsers.table.error', { error }) }}
      </div>

      <!-- Data Table -->
      <div v-else class="space-y-4">
        <!-- Search Input -->
        <div class="flex items-center py-4">
          <Input
            :placeholder="t('adminUsers.table.search.placeholder')"
            v-model="searchQuery"
            class="max-w-sm"
          />
        </div>

        <!-- Users Table Component -->
        <UserTableColumns
          :users="filteredUsers"
          :on-view-user="handleViewUser"
        />
      </div>
    </div>
  </NavbarLayout>
</template>
