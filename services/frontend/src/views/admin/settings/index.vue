<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Redirect to the default 'global' settings type on mount
onMounted(() => {
  router.replace('/admin/settings/global')
})
</script>

<template>
  <div>
    <!-- This component redirects to global settings by default -->
    <!-- The actual content is handled by [type].vue -->
  </div>
</template>
