<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, GitBranch, Globe } from 'lucide-vue-next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DeploymentService, type Repository, type Branch } from '@/services/deploymentService'
import { useEventBus } from '@/composables/useEventBus'
import { toast } from 'vue-sonner'

interface RepositorySelection {
  url: string
  name: string
  branch: string
  deployment_source: 'github_app' | 'github_public'
}

defineProps<{
  modelValue?: RepositorySelection
}>()

const emit = defineEmits<{
  'update:modelValue': [value: RepositorySelection]
}>()

const { t } = useI18n()
const eventBus = useEventBus()

// Active tab
const activeTab = ref<'github_app' | 'github_public'>('github_app')

// ========================================
// GitHub App tab state
// ========================================
const isCheckingConnection = ref(true)
const isConnected = ref(false)
const connectionError = ref<string | null>(null)

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

// ========================================
// Public Repository tab state
// ========================================
const publicRepoUrl = ref('')
const publicRepoError = ref<string | null>(null)
const publicBranches = ref<Branch[]>([])
const publicDefaultBranch = ref<string>('')
const publicBranch = ref('')
const isLoadingPublicBranches = ref(false)
const publicBranchesError = ref<string | null>(null)
let publicDebounceTimer: ReturnType<typeof setTimeout> | null = null

// ========================================
// GitHub App tab functions
// ========================================
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

  selectedRepo.value = null
  branch.value = ''
  branches.value = []
  branchesError.value = null

  emitEmpty()

  selectedRepo.value = repo
  selectedRepoId.value = repoIdStr

  fetchBranches(repo)
}

// ========================================
// Public Repository tab functions
// ========================================
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/)?$/)
  if (!match) return null
  return { owner: match[1]!, repo: match[2]! }
}

function handlePublicUrlInput() {
  publicRepoError.value = null
  publicBranches.value = []
  publicBranch.value = ''
  publicDefaultBranch.value = ''
  publicBranchesError.value = null
  emitEmpty()

  const url = publicRepoUrl.value.trim()
  if (!url) return

  const parsed = parseGitHubUrl(url)
  if (!parsed) {
    publicRepoError.value = 'Invalid GitHub URL. Expected format: https://github.com/owner/repo'
    return
  }

  // Debounce branch fetch
  if (publicDebounceTimer) clearTimeout(publicDebounceTimer)
  publicDebounceTimer = setTimeout(() => {
    fetchPublicBranches(parsed.owner, parsed.repo)
  }, 500)
}

async function fetchPublicBranches(owner: string, repo: string) {
  try {
    isLoadingPublicBranches.value = true
    publicBranchesError.value = null
    publicBranches.value = []

    const teamId = eventBus.getState<string>('selected_team_id')
    if (!teamId) {
      throw new Error('No team selected')
    }

    const response = await DeploymentService.getPublicBranches(teamId, owner, repo)
    publicBranches.value = response.branches
    publicDefaultBranch.value = response.default_branch
    publicBranch.value = response.default_branch
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load branches'
    publicBranchesError.value = errorMessage
  } finally {
    isLoadingPublicBranches.value = false
  }
}

// ========================================
// Emit helpers
// ========================================
function emitEmpty() {
  emit('update:modelValue', {
    url: '',
    name: '',
    branch: '',
    deployment_source: activeTab.value
  })
}

// Watch GitHub App tab selections
watch([selectedRepo, branch], () => {
  if (activeTab.value !== 'github_app') return

  if (selectedRepo.value && branch.value) {
    emit('update:modelValue', {
      url: selectedRepo.value.clone_url,
      name: selectedRepo.value.full_name,
      branch: branch.value,
      deployment_source: 'github_app'
    })
  } else {
    emitEmpty()
  }
})

// Watch Public Repository tab selections
watch([publicRepoUrl, publicBranch], () => {
  if (activeTab.value !== 'github_public') return

  const url = publicRepoUrl.value.trim()
  const parsed = parseGitHubUrl(url)

  if (parsed && publicBranch.value) {
    emit('update:modelValue', {
      url: `https://github.com/${parsed.owner}/${parsed.repo}`,
      name: `${parsed.owner}/${parsed.repo}`,
      branch: publicBranch.value,
      deployment_source: 'github_public'
    })
  } else {
    emitEmpty()
  }
})

// Reset parent state when switching tabs
watch(activeTab, () => {
  emitEmpty()
})

onMounted(() => {
  checkConnection()
})
</script>

<template>
  <div class="space-y-6">
    <Tabs v-model="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="github_app" class="flex items-center gap-2">
          <GitBranch class="h-4 w-4" />
          GitHub App
        </TabsTrigger>
        <TabsTrigger value="github_public" class="flex items-center gap-2">
          <Globe class="h-4 w-4" />
          Public Repository
        </TabsTrigger>
      </TabsList>

      <!-- ========================================== -->
      <!-- TAB 1: GitHub App (existing flow) -->
      <!-- ========================================== -->
      <TabsContent value="github_app" class="mt-6">
        <!-- Checking Connection -->
        <div v-if="isCheckingConnection" class="text-center py-8">
          <Spinner class="h-12 w-12 mx-auto mb-4" />
          <p class="text-muted-foreground">{{ t('deployments.wizard.connectGitHub.checking') }}</p>
        </div>

        <!-- Not Connected -->
        <div v-else-if="connectionError || !isConnected" class="text-center py-8">
          <div v-if="connectionError" class="mb-6">
            <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md mx-auto">
              <p class="text-destructive font-semibold">{{ connectionError }}</p>
            </div>
          </div>

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

        <!-- Connected - Repository Selection -->
        <div v-else>
          <div v-if="isLoading" class="text-center py-8">
            <Spinner class="h-12 w-12 mx-auto mb-4" />
            <p class="text-muted-foreground">{{ t('deployments.wizard.selectRepository.loading') }}</p>
          </div>

          <div v-else-if="error" class="text-center py-8">
            <p class="text-destructive mb-4">{{ error }}</p>
            <Button @click="fetchRepositories">
              {{ t('deployments.wizard.selectRepository.tryAgain') }}
            </Button>
          </div>

          <div v-else class="space-y-4">
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

              <div v-if="isLoadingBranches" class="flex items-center gap-2 p-3 border rounded-lg">
                <Spinner class="h-4 w-4" />
                <span class="text-sm text-muted-foreground">Loading branches...</span>
              </div>

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
      </TabsContent>

      <!-- ========================================== -->
      <!-- TAB 2: Public Repository -->
      <!-- ========================================== -->
      <TabsContent value="github_public" class="mt-6">
        <div class="space-y-4">
          <!-- URL Input -->
          <div class="space-y-2">
            <Label for="public-repo-url">GitHub Repository URL</Label>
            <Input
              id="public-repo-url"
              v-model="publicRepoUrl"
              placeholder="https://github.com/owner/repo"
              @input="handlePublicUrlInput"
            />
            <p v-if="publicRepoError" class="text-sm text-destructive">{{ publicRepoError }}</p>
            <p v-else class="text-xs text-muted-foreground">
              Paste the URL of any public GitHub repository
            </p>
          </div>

          <!-- Loading branches -->
          <div v-if="isLoadingPublicBranches" class="flex items-center gap-2 p-3 border rounded-lg">
            <Spinner class="h-4 w-4" />
            <span class="text-sm text-muted-foreground">Loading branches...</span>
          </div>

          <!-- Branch error -->
          <div v-else-if="publicBranchesError" class="p-3 border border-destructive/20 bg-destructive/5 rounded-lg">
            <div class="flex items-start gap-2">
              <AlertCircle class="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div class="flex-1">
                <p class="text-destructive text-sm">{{ publicBranchesError }}</p>
              </div>
            </div>
          </div>

          <!-- Branch Selection -->
          <div v-else-if="publicBranches.length > 0" class="space-y-2">
            <Label for="public-branch">Branch</Label>
            <Select v-model="publicBranch">
              <SelectTrigger class="w-full">
                <SelectValue :placeholder="publicBranch || 'Select a branch'" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="branchItem in publicBranches"
                  :key="branchItem.name"
                  :value="branchItem.name"
                >
                  <div class="flex items-center gap-2">
                    <span>{{ branchItem.name }}</span>
                    <span v-if="branchItem.name === publicDefaultBranch" class="text-xs text-muted-foreground">
                      (default)
                    </span>
                    <span v-if="branchItem.protected" class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                      protected
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <p class="text-xs text-muted-foreground">
              {{ publicBranches.length }} branch{{ publicBranches.length === 1 ? '' : 'es' }} available
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
