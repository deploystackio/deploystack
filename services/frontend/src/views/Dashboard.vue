<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { getEnv } from '@/utils/env'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const userEmail = ref('')
const userName = ref('')

interface UserData {
  id: string
  email: string
  username: string
  firstName?: string
  lastName?: string
}

const fetchUserData = async () => {
  loading.value = true
  error.value = ''

  try {
    const apiUrl = getEnv('VITE_DEPLOYSTACK_APP_URL')

    if (!apiUrl) {
      throw new Error('API URL not configured')
    }

    const response = await fetch(`${apiUrl}/api/users/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for session management
    })

    if (!response.ok) {
      if (response.status === 401) {
        // User not authenticated, redirect to login
        router.push('/login')
        return
      }
      throw new Error(`Failed to fetch user data: ${response.status}`)
    }

    const data = await response.json()

    if (data.success && data.data) {
      const userData: UserData = data.data
      userEmail.value = userData.email
      userName.value = userData.username
    } else {
      throw new Error('Invalid response format')
    }

  } catch (e) {
    console.error('Error fetching user data:', e)
    if (e instanceof Error) {
      error.value = e.message
    } else {
      error.value = 'Failed to load user data'
    }
  } finally {
    loading.value = false
  }
}

const logout = () => {
  router.push('/logout')
}

onMounted(() => {
  fetchUserData()
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="text-center space-y-6 p-8">
      <!-- Loading state -->
      <div v-if="loading" class="space-y-4">
        <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        <p class="text-muted-foreground">Loading dashboard...</p>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="space-y-4">
        <h1 class="text-2xl font-bold text-destructive">Error</h1>
        <p class="text-muted-foreground">{{ error }}</p>
        <Button @click="fetchUserData" variant="outline">
          Try Again
        </Button>
      </div>

      <!-- Success state -->
      <div v-else class="space-y-6">
        <div class="space-y-2">
          <h1 class="text-3xl font-bold">Dashboard</h1>
          <p class="text-muted-foreground">Welcome to your dashboard</p>
        </div>

        <div class="space-y-2">
          <p class="text-sm text-muted-foreground">Logged in as:</p>
          <p class="text-xl font-medium">{{ userEmail }}</p>
        </div>

        <Button @click="logout" variant="outline" class="mt-6">
          Logout
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-background {
  background-color: hsl(var(--background));
}
.text-muted-foreground {
  color: hsl(var(--muted-foreground));
}
.text-destructive {
  color: hsl(var(--destructive));
}
.border-primary {
  border-color: hsl(var(--primary));
}
</style>
