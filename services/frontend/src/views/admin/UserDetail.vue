<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Mail, Github } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
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
    text: isEmail ? 'Email' : 'GitHub'
  }
})

const goBack = () => {
  router.push('/admin/users')
}
</script>

<template>
  <DashboardLayout :title="`User: ${user?.username || 'Loading...'}`">
    <div class="space-y-6">
      <!-- Back Button -->
      <div>
        <Button 
          variant="outline" 
          @click="goBack"
          class="mb-4"
        >
          <ArrowLeft class="h-4 w-4 mr-2" />
          Back to Users
        </Button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        Loading user details...
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        Error loading user: {{ error }}
      </div>

      <!-- User Details -->
      <div v-else-if="user" class="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              User information and account details.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Username -->
            <div class="space-y-2">
              <Label>Username</Label>
              <div class="text-sm font-medium">{{ user.username }}</div>
            </div>

            <!-- Email -->
            <div class="space-y-2">
              <Label>Email</Label>
              <div class="text-sm">{{ user.email }}</div>
            </div>

            <!-- Full Name -->
            <div class="space-y-2">
              <Label>Full Name</Label>
              <div class="text-sm">
                {{ displayName === user.username ? 'Not provided' : displayName }}
              </div>
            </div>

            <!-- First Name -->
            <div class="space-y-2">
              <Label>First Name</Label>
              <div class="text-sm">{{ user.first_name || 'Not provided' }}</div>
            </div>

            <!-- Last Name -->
            <div class="space-y-2">
              <Label>Last Name</Label>
              <div class="text-sm">{{ user.last_name || 'Not provided' }}</div>
            </div>

            <!-- Authentication Type -->
            <div class="space-y-2">
              <Label>Registration Method</Label>
              <div v-if="authTypeBadge">
                <Badge 
                  :variant="authTypeBadge.variant"
                  class="flex items-center gap-1 w-fit"
                >
                  <component :is="authTypeBadge.icon" class="h-3 w-3" />
                  {{ authTypeBadge.text }}
                </Badge>
              </div>
            </div>

            <!-- GitHub ID (if applicable) -->
            <div v-if="user.github_id" class="space-y-2">
              <Label>GitHub ID</Label>
              <div class="text-sm font-mono">{{ user.github_id }}</div>
            </div>

            <!-- Role -->
            <div class="space-y-2">
              <Label>Role</Label>
              <div class="text-sm">
                {{ user.role ? user.role.name : 'No role assigned' }}
              </div>
            </div>

            <!-- Role Permissions (if role exists) -->
            <div v-if="user.role && user.role.permissions.length > 0" class="space-y-2">
              <Label>Permissions</Label>
              <div class="flex flex-wrap gap-1">
                <Badge 
                  v-for="permission in user.role.permissions" 
                  :key="permission"
                  variant="outline"
                  class="text-xs"
                >
                  {{ permission }}
                </Badge>
              </div>
            </div>

            <!-- User ID -->
            <div class="space-y-2">
              <Label>User ID</Label>
              <div class="text-sm font-mono text-muted-foreground">{{ user.id }}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </DashboardLayout>
</template>
