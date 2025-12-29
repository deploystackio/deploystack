import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { UserService, type User } from '@/services/userService'

export function useUserDetailCache() {
  const route = useRoute()
  const { t } = useI18n()
  const eventBus = useEventBus()
  const { setBreadcrumbs } = useBreadcrumbs()

  const user = ref<User | null>(null)
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  const userId = route.params.id as string
  const storageKeyName = `admin_user_name_${userId}`
  const storageKeyUser = `admin_user_data_${userId}`

  async function loadAndSetUser() {
    try {
      isLoading.value = true
      const fetchedUser = await UserService.getById(userId)

      user.value = fetchedUser
      error.value = null

      // Cache the user username for instant loading on tab switches
      eventBus.setState(storageKeyName, fetchedUser.username)

      // Cache the full user object for instant loading
      eventBus.setState(storageKeyUser, fetchedUser)

      // Update breadcrumbs with username
      setBreadcrumbs([
        { label: t('adminUsers.title'), href: '/admin/users' },
        { label: fetchedUser.username }
      ])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An unknown error occurred'
      user.value = null

      // Clear cached data on error
      eventBus.clearState(storageKeyName)
      eventBus.clearState(storageKeyUser)
    } finally {
      isLoading.value = false
    }
  }

  function initializeCache() {
    // Set initial breadcrumbs with loading state
    setBreadcrumbs([
      { label: t('adminUsers.title'), href: '/admin/users' },
      { label: 'Loading...' }
    ])

    // Load cached user data immediately to prevent flicker
    const cachedName = eventBus.getState<string>(storageKeyName)
    const cachedUser = eventBus.getState<User>(storageKeyUser)

    if (cachedUser && !user.value) {
      user.value = cachedUser
    } else if (cachedName && !user.value) {
      // At minimum, show cached username
      user.value = {
        username: cachedName
      } as User
    }
  }

  function setupWatchers() {
    // Watch for user ID changes in route to clear cached data
    watch(
      () => route.params.id,
      (newId, oldId) => {
        if (newId && oldId && newId !== oldId) {
          // Clear old user's cached data
          const oldStorageKeyName = `admin_user_name_${oldId}`
          const oldStorageKeyUser = `admin_user_data_${oldId}`
          eventBus.clearState(oldStorageKeyName)
          eventBus.clearState(oldStorageKeyUser)

          // Reset user to null to trigger loading state
          user.value = null

          // Load new user
          loadAndSetUser()
        }
      }
    )

    // Watch user value changes to update cache
    watch(
      () => user.value,
      (newUser) => {
        if (newUser) {
          eventBus.setState(storageKeyName, newUser.username)
          eventBus.setState(storageKeyUser, newUser)
        }
      },
      { deep: true }
    )
  }

  function cleanupWatchers() {
    // No specific cleanup needed - Vue handles watch cleanup automatically
    // This function exists for API consistency with the teams pattern
  }

  return {
    user,
    isLoading,
    error,
    userId,
    loadAndSetUser,
    initializeCache,
    setupWatchers,
    cleanupWatchers
  }
}
