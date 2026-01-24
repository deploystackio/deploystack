<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle, AlertCircle } from 'lucide-vue-next'
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
  'next': []
  'back': []
}>()

const { t } = useI18n()
const eventBus = useEventBus()

const repositories = ref<Repository[]>([])
const selectedRepo = ref<Repository | null>(null)
const branch = ref('main')
const branches = ref<Branch[]>([])
const defaultBranch = ref<string>('')
const isLoadingBranches = ref(false)
const branchesError = ref<string | null>(null)
const searchQuery = ref('')
const isLoading = ref(true)
const error = ref<string | null>(null)

const filteredRepositories = computed(() => {
  if (!searchQuery.value) return repositories.value

  const query = searchQuery.value.toLowerCase()
  return repositories.value.filter(repo =>
    repo.full_name.toLowerCase().includes(query) ||
    repo.description?.toLowerCase().includes(query)
  )
})

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

function selectRepository(repo: Repository) {
  selectedRepo.value = repo
  branch.value = repo.default_branch

  // Fetch branches for the selected repository
  fetchBranches(repo)
}

function handleNext() {
  if (!selectedRepo.value) return

  emit('update:modelValue', {
    url: selectedRepo.value.clone_url,
    name: selectedRepo.value.full_name,
    branch: branch.value
  })

  emit('next')
}

onMounted(() => {
  fetchRepositories()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-bold mb-2">{{ t('deployments.wizard.selectRepository.title') }}</h2>
    </div>

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

    <!-- Repository List -->
    <div v-else class="space-y-4">
      <!-- Search -->
      <Input
        v-model="searchQuery"
        type="text"
        :placeholder="t('deployments.wizard.selectRepository.searchPlaceholder')"
        class="w-full"
      />

      <!-- Repository List -->
      <div class="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-2">
        <div
          v-for="repo in filteredRepositories"
          :key="repo.id"
          @click="selectRepository(repo)"
          :class="[
            'p-4 border rounded-lg cursor-pointer transition',
            selectedRepo?.id === repo.id
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          ]"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="font-semibold truncate">{{ repo.full_name }}</div>
              <p v-if="repo.description" class="text-sm text-muted-foreground mt-1 line-clamp-2">
                {{ repo.description }}
              </p>
              <div class="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>{{ t('deployments.wizard.selectRepository.defaultBranch') }}: {{ repo.default_branch }}</span>
                <span v-if="repo.private" class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                  {{ t('deployments.wizard.selectRepository.private') }}
                </span>
              </div>
            </div>
            <div v-if="selectedRepo?.id === repo.id" class="text-primary ml-4 flex-shrink-0">
              <CheckCircle class="h-6 w-6" />
            </div>
          </div>
        </div>
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
          <SelectTrigger>
            <SelectValue :placeholder="branch || 'Select a branch'" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="branchItem in branches"
              :key="branchItem.name"
              :value="branchItem.name"
            >
              <div class="flex items-center justify-between gap-2">
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

      <!-- Navigation Buttons -->
      <div class="flex justify-between pt-4">
        <Button variant="outline" @click="$emit('back')">
          {{ t('deployments.wizard.buttons.back') }}
        </Button>
        <Button
          @click="handleNext"
          :disabled="!selectedRepo || branches.length === 0 || !!branchesError"
        >
          {{ t('deployments.wizard.buttons.next') }}
        </Button>
      </div>
    </div>
  </div>
</template>
