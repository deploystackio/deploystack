<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Redirect to profile by default
onMounted(() => {
  router.replace('/user/profile')
})
</script>

<template>
  <div>
    <!-- This component just redirects, no content needed -->
  </div>
</template>
