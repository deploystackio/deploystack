<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Skeleton } from '@/components/ui/skeleton'
import NavbarLayout from '@/components/NavbarLayout.vue'
import {
  UserDetailTabs,
  UserDetailPageHeading,
  UserDetailGeneral,
  ForceResetPasswordButton
} from '@/components/admin/users'
import { useUserDetailCache } from '@/composables/admin/users/useUserDetailCache'

const { t } = useI18n()

const {
  user,
  isLoading,
  error,
  userId,
  loadAndSetUser,
  initializeCache,
  setupWatchers,
  cleanupWatchers
} = useUserDetailCache()

// Handle role changes - re-fetch user to get updated data
const handleRoleChanged = async () => {
  await loadAndSetUser()
  // Cache will auto-update via watcher in composable
}

onMounted(async () => {
  initializeCache()       // Load cached data first (instant display)
  await loadAndSetUser()  // Then fetch fresh data
  setupWatchers()         // Set up route/event watchers
})

onUnmounted(() => {
  cleanupWatchers()
})
</script>

<template>
  <NavbarLayout>
    <UserDetailPageHeading :user="user" :is-loading="isLoading">
      <!-- Force Reset Password action in header -->
      <template #actions>
        <ForceResetPasswordButton
          v-if="user"
          :user="user"
        />
      </template>
    </UserDetailPageHeading>

    <div class="space-y-6 mt-6">
      <!-- Error State -->
      <div v-if="error" class="text-red-500">
        {{ t('adminUsers.userDetail.errorLoading', { error }) }}
      </div>

      <!-- Loading State for Content -->
      <div v-else-if="isLoading" class="space-y-4">
        <Skeleton class="h-32 w-full rounded-lg" />
        <Skeleton class="h-32 w-full rounded-lg" />
        <Skeleton class="h-32 w-full rounded-lg" />
      </div>

      <!-- Tabs with Content (sidebar + content area) -->
      <UserDetailTabs v-else-if="user" :user="user" :user-id="userId">
        <UserDetailGeneral
          :user="user"
          @role-changed="handleRoleChanged"
        />
      </UserDetailTabs>
    </div>
  </NavbarLayout>
</template>
