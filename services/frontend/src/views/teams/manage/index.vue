<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { TeamService } from '@/services/teamService'

const router = useRouter()

onMounted(async () => {
  try {
    // Use the new getUserDefaultTeam method
    const defaultTeam = await TeamService.getUserDefaultTeam()
    if (defaultTeam) {
      router.replace(`/teams/manage/${defaultTeam.id}`)
    } else {
      // Fallback: redirect to teams list if no default team found
      router.replace('/teams')
    }
  } catch (error) {
    console.error('Error fetching default team:', error)
    // Fallback: redirect to teams list on error
    router.replace('/teams')
  }
})
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      <p class="mt-2 text-gray-600">Redirecting to your default team...</p>
    </div>
  </div>
</template>
