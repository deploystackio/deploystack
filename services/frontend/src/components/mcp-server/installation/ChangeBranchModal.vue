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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { DeploymentService, type Branch } from '@/services/deploymentService'

interface Props {
  open: boolean
  teamId: string
  serverId: string
  currentBranch: string
  owner: string
  repo: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'branch-changed': [data: { previous_branch: string; new_branch: string; commit_sha: string }]
}>()

// State
const selectedBranch = ref<string>('')
const branches = ref<Branch[]>([])
const defaultBranch = ref<string>('')
const isLoadingBranches = ref(false)
const isUpdating = ref(false)
const branchesError = ref<string | null>(null)

// Computed
const canUpdate = computed(() => {
  return selectedBranch.value && selectedBranch.value !== props.currentBranch && !isUpdating.value
})

// Methods
async function fetchBranches() {
  isLoadingBranches.value = true
  branchesError.value = null
  branches.value = []
  defaultBranch.value = ''

  try {
    const response = await DeploymentService.getBranchesForServer(
      props.teamId,
      props.owner,
      props.repo
    )
    branches.value = response.branches
    defaultBranch.value = response.default_branch
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch branches'
    branchesError.value = errorMessage
    console.error('Failed to fetch branches:', error)
  } finally {
    isLoadingBranches.value = false
  }
}

async function handleUpdate() {
  if (!canUpdate.value) return

  isUpdating.value = true

  try {
    const response = await DeploymentService.updateServerBranch(
      props.teamId,
      props.serverId,
      selectedBranch.value
    )

    toast.success('Branch updated successfully', {
      description: `Switched from ${response.data.previous_branch} to ${response.data.new_branch}.`
    })

    // Emit branch-changed event with the response data
    emit('branch-changed', {
      previous_branch: response.data.previous_branch,
      new_branch: response.data.new_branch,
      commit_sha: response.data.commit_sha
    })

    handleClose()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update branch'
    toast.error('Failed to update branch', {
      description: errorMessage
    })
  } finally {
    isUpdating.value = false
  }
}

function handleClose() {
  emit('update:open', false)
  // Reset state
  selectedBranch.value = ''
  branches.value = []
  defaultBranch.value = ''
  branchesError.value = null
}

// Watch for open prop to fetch branches and reset state
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      // Reset state when opening
      selectedBranch.value = ''
      branches.value = []
      defaultBranch.value = ''
      branchesError.value = null

      // Fetch fresh branch data
      fetchBranches()
    }
  }
)
</script>

<template>
  <Dialog :open="open" @update:open="handleClose">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Change Branch</DialogTitle>
        <DialogDescription>
          Select the branch to monitor for auto-deploy. Changes pushed to this branch will trigger automatic redeployment.
        </DialogDescription>
      </DialogHeader>

      <!-- Loading State -->
      <div v-if="isLoadingBranches" class="space-y-2">
        <Skeleton class="h-4 w-20" />
        <Skeleton class="h-10 w-full" />
      </div>

      <!-- Error State -->
      <div v-else-if="branchesError" class="text-sm text-destructive">
        {{ branchesError }}
      </div>

      <!-- Branch Selection -->
      <div v-else class="space-y-4">
        <div class="space-y-2">
          <Label>Current Branch</Label>
          <div class="text-sm text-muted-foreground">{{ currentBranch }}</div>
        </div>

        <div class="space-y-2">
          <Label for="branch">New Branch</Label>
          <Select v-model="selectedBranch">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Select a branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="branch in branches"
                :key="branch.name"
                :value="branch.name"
                :disabled="branch.name === currentBranch"
              >
                <div class="flex items-center gap-2">
                  <span>{{ branch.name }}</span>
                  <span v-if="branch.name === defaultBranch" class="text-xs text-muted-foreground">
                    (default)
                  </span>
                  <span
                    v-if="branch.protected"
                    class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded"
                  >
                    protected
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline" :disabled="isUpdating"> Cancel </Button>
        </DialogClose>
        <Button
          @click="handleUpdate"
          :disabled="!canUpdate"
          class="bg-black text-white border-black hover:bg-black/90 hover:border-black hover:text-white"
        >
          <Spinner v-if="isUpdating" class="mr-2" />
          Change Branch
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
