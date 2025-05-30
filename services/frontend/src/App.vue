<template>
  <div class="min-h-screen bg-gray-50">
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useDatabaseStore } from '@/stores/database'

const databaseStore = useDatabaseStore()

// Initialize database status check on app startup
onMounted(async () => {
  try {
    await databaseStore.checkDatabaseStatus(true)
  } catch (error) {
    console.warn('Failed to check database status on app startup:', error)
  }
})
</script>
