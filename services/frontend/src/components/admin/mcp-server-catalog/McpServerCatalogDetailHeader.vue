<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { McpServerCatalogDetailPageHeading } from '@/components/admin/mcp-server-catalog'
import { McpCatalogService } from '@/services/mcpCatalogService'
import McpServerDeleteDialog from '@/components/mcp-server/McpServerDeleteDialog.vue'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'

interface Props {
  server: McpServer | null
  isLoading?: boolean
  serverId: string
}

const props = defineProps<Props>()
const router = useRouter()

const isDeleting = ref(false)
const showDeleteDialog = ref(false)

// Delete server
const deleteServer = async () => {
  try {
    isDeleting.value = true
    const serverName = props.server?.name || 'Unknown Server'
    await McpCatalogService.deleteGlobalServer(props.serverId)

    router.push({
      path: '/admin/mcp-server-catalog',
      query: { deletionQueued: serverName }
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete server'
    console.error('Error deleting server:', err)
    toast.error(errorMessage)
  } finally {
    isDeleting.value = false
    showDeleteDialog.value = false
  }
}

// Navigate to edit page
const handleEditServer = () => {
  router.push(`/admin/mcp-server-catalog/edit/${props.serverId}`)
}

// Navigate to install page
const handleInstallServer = () => {
  router.push(`/mcp-server/install/${props.serverId}`)
}
</script>

<template>
  <McpServerCatalogDetailPageHeading :server="server" :is-loading="isLoading">
    <template #actions>
      <div v-if="server" class="flex items-center gap-2">
        <ButtonGroup>
          <Button variant="outline" @click="handleInstallServer">
            Install
          </Button>
          <Button variant="outline" @click="handleEditServer">
            Edit
          </Button>
        </ButtonGroup>
        <span class="text-neutral-300">|</span>
        <Button variant="outline" :disabled="isDeleting" @click="showDeleteDialog = true" class="text-red-600 hover:text-red-600">
          Delete
        </Button>
      </div>
    </template>
  </McpServerCatalogDetailPageHeading>

  <!-- Delete Confirmation Dialog -->
  <McpServerDeleteDialog
    v-model:open="showDeleteDialog"
    :server-name="server?.name || ''"
    :is-deleting="isDeleting"
    @confirm="deleteServer"
  />
</template>
