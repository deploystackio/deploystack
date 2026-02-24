<script setup lang="ts">
/**
 * Lightweight page loaded in the OAuth popup after the backend callback completes.
 * Since this page is same-origin as the parent window, BroadcastChannel works
 * to notify the install wizard, even when window.opener is null.
 */
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

onMounted(() => {
  const type = route.query.type as string
  const installationId = route.query.installation_id as string
  const error = route.query.error as string

  if (type) {
    try {
      const bc = new BroadcastChannel('deploystack_oauth')
      bc.postMessage({
        type,
        installation_id: installationId || undefined,
        error: error || undefined
      })
      bc.close()
    } catch {
      // BroadcastChannel not supported
    }
  }

  // Always try to close the popup
  window.close()
})
</script>

<template>
  <div class="flex items-center justify-center h-screen bg-gray-50">
    <div class="text-center p-8 bg-white rounded-lg shadow-sm">
      <p class="text-gray-600">Completing authorization...</p>
      <p class="text-sm text-gray-400 mt-2">This window will close automatically.</p>
    </div>
  </div>
</template>
