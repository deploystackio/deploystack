<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { McpCategoriesService } from '@/services/mcpCategoriesService'
import DashboardLayout from '@/components/DashboardLayout.vue'

const router = useRouter()

onMounted(async () => {
  try {
    const categories = await McpCategoriesService.getCategories()
    const firstCategory = categories[0]
    if (firstCategory) {
      router.replace(`/mcp-server/catalog/${firstCategory.id}`)
    }
  } catch (error) {
    console.error('Failed to load categories:', error)
  }
})
</script>

<template>
  <DashboardLayout>
    <div class="flex items-center justify-center min-h-[50vh]">
      <div class="text-muted-foreground">Loading catalog...</div>
    </div>
  </DashboardLayout>
</template>
