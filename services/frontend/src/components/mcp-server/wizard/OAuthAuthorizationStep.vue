<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Lock } from 'lucide-vue-next'

interface ServerData {
  name: string
  description?: string
  [key: string]: unknown
}

interface Props {
  serverData?: ServerData
  isAuthorizing?: boolean
}

withDefaults(defineProps<Props>(), {
  isAuthorizing: false
})

const emit = defineEmits<{
  authorize: []
}>()

const handleAuthorize = () => {
  emit('authorize')
}
</script>

<template>
  <div class="space-y-6">
    <!-- OAuth Explanation Card -->
    <div class="bg-muted/50 p-6 rounded-lg border">
      <div class="flex items-center gap-3 mb-4">
        <div class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock class="h-5 w-5 text-primary" />
        </div>
        <h3 class="text-lg font-semibold">OAuth Authentication Required</h3>
      </div>

      <p class="text-sm text-muted-foreground mb-4">
        This server requires OAuth authentication to access your account.
        You'll be redirected to authorize DeployStack to access your
        <span v-if="serverData?.name" class="font-medium">{{ serverData.name }}</span>
        <span v-else>account</span> on your behalf.
      </p>

      <p class="text-sm text-muted-foreground">
        After authorization, you'll be able to use this MCP server with your team.
      </p>
    </div>

    <!-- Authorization Button (Centered) -->
    <div class="flex justify-center py-8">
      <Button
        @click="handleAuthorize"
        size="lg"
        class="gap-2"
        :disabled="isAuthorizing"
      >
        <Spinner v-if="isAuthorizing" class="mr-2" />
        <Lock v-else class="h-4 w-4" />
        <span v-if="serverData?.name">Authorize with {{ serverData.name }}</span>
        <span v-else>Authorize</span>
      </Button>
    </div>

    <!-- Info Note -->
    <div class="text-center text-sm text-muted-foreground">
      <p>A new window will open for authentication.</p>
      <p class="mt-1">Please allow popups for this site if prompted.</p>
    </div>
  </div>
</template>
