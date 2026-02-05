<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { toast } from 'vue-sonner'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { GitCommit } from 'lucide-vue-next'
import { DeploymentService } from '@/services/deploymentService'

interface Props {
  open: boolean
  teamId: string
  serverId: string
  currentBranch: string
  currentCommitSha: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'redeploy-complete': [data: { previous_sha: string; new_sha: string; instances_notified: number }]
}>()

// State
const isLoadingStatus = ref(false)
const isRedeploying = ref(false)
const statusError = ref<string | null>(null)
const remoteSha = ref<string>('')
const hasNewCommit = ref(false)

// Computed
const currentShortSha = computed(() => props.currentCommitSha.substring(0, 7))
const remoteShortSha = computed(() => remoteSha.value.substring(0, 7))
const canRedeploy = computed(() => !isRedeploying.value && remoteSha.value !== '')

// Methods
async function checkStatus() {
  isLoadingStatus.value = true
  statusError.value = null
  remoteSha.value = ''
  hasNewCommit.value = false

  try {
    const response = await DeploymentService.checkDeploymentStatus(
      props.teamId,
      props.serverId
    )
    remoteSha.value = response.data.remote_sha
    hasNewCommit.value = response.data.has_new_commit
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to check deployment status'
    statusError.value = errorMessage
    console.error('Failed to check deployment status:', error)
  } finally {
    isLoadingStatus.value = false
  }
}

async function handleRedeploy() {
  if (!canRedeploy.value) return

  isRedeploying.value = true

  try {
    const response = await DeploymentService.triggerRedeploy(
      props.teamId,
      props.serverId
    )

    toast.success('Redeployment triggered successfully', {
      description: `Updated from ${response.data.previous_sha.substring(0, 7)} to ${response.data.new_sha.substring(0, 7)}. ${response.data.instances_notified} instance(s) will be redeployed.`
    })

    // Emit redeploy-complete event
    emit('redeploy-complete', {
      previous_sha: response.data.previous_sha,
      new_sha: response.data.new_sha,
      instances_notified: response.data.instances_notified
    })

    handleClose()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to trigger redeployment'
    toast.error('Redeployment failed', {
      description: errorMessage
    })
  } finally {
    isRedeploying.value = false
  }
}

function handleClose() {
  emit('update:open', false)
  // Reset state
  remoteSha.value = ''
  hasNewCommit.value = false
  statusError.value = null
}

// Watch for open prop to check status
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      // Reset state when opening
      remoteSha.value = ''
      hasNewCommit.value = false
      statusError.value = null

      // Check deployment status
      checkStatus()
    }
  }
)
</script>

<template>
  <Dialog :open="open" @update:open="handleClose">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Redeploy MCP Server</DialogTitle>
        <DialogDescription>
          Fetch the latest commit from GitHub and redeploy all team member instances. This will restart the MCP server with the latest code.
        </DialogDescription>
      </DialogHeader>

      <!-- Loading State -->
      <div v-if="isLoadingStatus" class="space-y-2">
        <Skeleton class="h-4 w-32" />
        <Skeleton class="h-10 w-full" />
        <Skeleton class="h-4 w-32" />
        <Skeleton class="h-10 w-full" />
      </div>

      <!-- Error State -->
      <div v-else-if="statusError" class="text-sm text-destructive">
        {{ statusError }}
      </div>

      <!-- Deployment Info -->
      <div v-else class="space-y-4">
        <div class="space-y-2">
          <div class="text-sm font-medium">Current Deployment</div>
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <GitCommit class="h-4 w-4" />
            <span class="font-mono">{{ currentShortSha }}</span>
            <span class="text-xs">on {{ currentBranch }}</span>
          </div>
        </div>

        <div class="space-y-2">
          <div class="text-sm font-medium">Latest Remote Commit</div>
          <div class="flex items-center gap-2 text-sm">
            <GitCommit class="h-4 w-4" />
            <span class="font-mono">{{ remoteShortSha }}</span>
            <span
              v-if="hasNewCommit"
              class="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded"
            >
              New version available
            </span>
            <span
              v-else
              class="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded"
            >
              Up to date
            </span>
          </div>
        </div>

        <div v-if="!hasNewCommit" class="text-sm text-muted-foreground p-3 bg-muted rounded-md">
          No new commits detected. You can still trigger a redeploy to restart the MCP server processes.
        </div>
      </div>

      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline" :disabled="isRedeploying">
            Cancel
          </Button>
        </DialogClose>
        <Button
          @click="handleRedeploy"
          :disabled="!canRedeploy"
          class="bg-black text-white border-black hover:bg-black/90 hover:border-black hover:text-white"
        >
          <Spinner v-if="isRedeploying" class="mr-2" />
          {{ isRedeploying ? 'Redeploying...' : 'Redeploy' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
