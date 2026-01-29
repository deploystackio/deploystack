<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle, GitBranch } from 'lucide-vue-next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DeploymentService, type Repository, type Branch } from '@/services/deploymentService'
import { useEventBus } from '@/composables/useEventBus'
import { toast } from 'vue-sonner'

interface RepositorySelection {
  url: string
  name: string
  branch: string
}

defineProps<{
  modelValue?: RepositorySelection
}>()

const emit = defineEmits<{
  'update:modelValue': [value: RepositorySelection]
}>()

const { t } = useI18n()
const eventBus = useEventBus()

// GitHub connection state
const isCheckingConnection = ref(true)
const isConnected = ref(false)
const connectionError = ref<string | null>(null)

// Repository state
const repositories = ref<Repository[]>([])
const selectedRepoId = ref<string>('')
const selectedRepo = ref<Repository | null>(null)
const branch = ref('main')
const branches = ref<Branch[]>([])
const defaultBranch = ref<string>('')
const isLoadingBranches = ref(false)
const branchesError = ref<string | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

async function checkConnection() {
  try {
    isCheckingConnection.value = true
    connectionError.value = null

    const teamId = eventBus.getState<string>('selected_team_id')
    if (!teamId) {
      throw new Error('No team selected')
    }

    const result = await DeploymentService.checkConnection(teamId)
    isConnected.value = result.connected

    if (result.connected) {
      await fetchRepositories()
    }
  } catch (err) {
    connectionError.value = err instanceof Error ? err.message : 'Failed to check connection'
    toast.error(t('deployments.notifications.connectionError'))
  } finally {
    isCheckingConnection.value = false
  }
}

function connectGitHub() {
  const teamId = eventBus.getState<string>('selected_team_id')
  if (!teamId) {
    toast.error('No team selected')
    return
  }

  window.location.href = `${DeploymentService['baseUrl']}/api/teams/${teamId}/deploy/github/install`
}

async function fetchRepositories() {
  try {
    isLoading.value = true
    error.value = null

    const teamId = eventBus.getState<string>('selected_team_id')
    if (!teamId) {
      throw new Error('No team selected')
    }

    repositories.value = await DeploymentService.getRepositories(teamId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load repositories'
    toast.error(t('deployments.notifications.repositoriesError'))
  } finally {
    isLoading.value = false
  }
}

async function fetchBranches(repo: Repository) {
  try {
    isLoadingBranches.value = true
    branchesError.value = null
    branches.value = []

    const teamId = eventBus.getState<string>('selected_team_id')
    if (!teamId) {
      throw new Error('No team selected')
    }

    const response = await DeploymentService.getBranches(teamId, repo.owner, repo.name)
    branches.value = response.branches
    defaultBranch.value = response.default_branch
    branch.value = response.default_branch
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load branches'
    branchesError.value = errorMessage

    // If repository is empty, show clear warning
    if (errorMessage.includes('empty')) {
      toast.warning('Repository is empty', {
        description: 'Push code to this repository before deploying'
      })
    } else {
      toast.error('Failed to load branches')
    }
  } finally {
    isLoadingBranches.value = false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleRepoChange(repoId: any) {
  if (!repoId) return

  const repoIdStr = String(repoId)
  const repo = repositories.value.find(r => r.id.toString() === repoIdStr)
  if (!repo) return

  selectedRepo.value = repo
  selectedRepoId.value = repoIdStr
  branch.value = repo.default_branch

  // Fetch branches for the selected repository
  fetchBranches(repo)
}

// Watch for changes and emit to parent
watch([selectedRepo, branch], () => {
  if (selectedRepo.value) {
    emit('update:modelValue', {
      url: selectedRepo.value.clone_url,
      name: selectedRepo.value.full_name,
      branch: branch.value
    })
  }
})

onMounted(() => {
  checkConnection()
})
</script>

<template>
  <div class="space-y-6">
      <!-- STATE 1: Checking Connection -->
      <div v-if="isCheckingConnection" class="text-center py-8">
        <Spinner class="h-12 w-12 mx-auto mb-4" />
        <p class="text-muted-foreground">{{ t('deployments.wizard.connectGitHub.checking') }}</p>
      </div>

      <!-- STATE 2: Connection Error or Not Connected -->
      <div v-else-if="connectionError || !isConnected" class="text-center py-8">
      <!-- Error message if any -->
      <div v-if="connectionError" class="mb-6">
        <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md mx-auto">
          <p class="text-destructive font-semibold">{{ connectionError }}</p>
        </div>
      </div>

      <!-- Connect GitHub UI -->
      <div v-if="!isConnected" class="text-center">
        <GitBranch class="h-20 w-20 mx-auto text-muted-foreground mb-6" />
        <p class="text-muted-foreground mb-6">
          {{ t('deployments.wizard.connectGitHub.description') }}
        </p>
        <Button @click="connectGitHub" class="inline-flex items-center gap-2">
          <GitBranch class="h-5 w-5" />
          {{ t('deployments.wizard.connectGitHub.button') }}
        </Button>
        <p class="text-xs text-muted-foreground mt-4">
          {{ t('deployments.wizard.connectGitHub.notice') }}
        </p>
      </div>

    </div>

    <!-- STATE 3: Connected - Show Repository Selection -->
    <div v-else>
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-8">
        <Spinner class="h-12 w-12 mx-auto mb-4" />
        <p class="text-muted-foreground">{{ t('deployments.wizard.selectRepository.loading') }}</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-8">
        <p class="text-destructive mb-4">{{ error }}</p>
        <Button @click="fetchRepositories">
          {{ t('deployments.wizard.selectRepository.tryAgain') }}
        </Button>
      </div>

      <!-- Repository Selection -->
      <div v-else class="space-y-4">
      <!-- Repository Select -->
      <div class="space-y-2">
        <Label for="repository">{{ t('deployments.wizard.selectRepository.repositoryLabel') }}</Label>
        <Select v-model="selectedRepoId" @update:model-value="handleRepoChange">
          <SelectTrigger class="w-full">
            <SelectValue :placeholder="t('deployments.wizard.selectRepository.repositoryPlaceholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="repo in repositories"
              :key="repo.id"
              :value="repo.id.toString()"
            >
              <div class="flex flex-col items-start">
                <span class="font-medium">{{ repo.full_name }}</span>
                <span v-if="repo.description" class="text-xs text-muted-foreground line-clamp-1">
                  {{ repo.description }}
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Branch Selection -->
      <div v-if="selectedRepo" class="space-y-2">
        <Label for="branch">{{ t('deployments.wizard.selectRepository.branchLabel') }}</Label>

        <!-- Loading branches -->
        <div v-if="isLoadingBranches" class="flex items-center gap-2 p-3 border rounded-lg">
          <Spinner class="h-4 w-4" />
          <span class="text-sm text-muted-foreground">Loading branches...</span>
        </div>

        <!-- Empty repository warning -->
        <div v-else-if="branchesError" class="p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
          <div class="flex items-start gap-2">
            <AlertCircle class="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div class="flex-1">
              <p class="font-semibold text-yellow-900 text-sm">Repository is empty</p>
              <p class="text-yellow-700 text-sm mt-1">
                This repository has no branches or commits. Please push code to the repository before deploying.
              </p>
            </div>
          </div>
        </div>

        <!-- Branch dropdown -->
        <Select v-else v-model="branch" :disabled="branches.length === 0">
          <SelectTrigger class="w-full">
            <SelectValue :placeholder="branch || 'Select a branch'" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="branchItem in branches"
              :key="branchItem.name"
              :value="branchItem.name"
            >
              <div class="flex items-center gap-2">
                <span>{{ branchItem.name }}</span>
                <span v-if="branchItem.name === defaultBranch" class="text-xs text-muted-foreground">
                  (default)
                </span>
                <span v-if="branchItem.protected" class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                  protected
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <p v-if="branches.length > 0" class="text-xs text-muted-foreground">
          {{ branches.length }} branch{{ branches.length === 1 ? '' : 'es' }} available
        </p>
      </div>
      </div>
    </div>
  </div>
</template>
