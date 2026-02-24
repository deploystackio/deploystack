<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle } from 'lucide-vue-next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DeploymentService, type Branch } from '@/services/deploymentService'
import { useEventBus } from '@/composables/useEventBus'

const props = defineProps<{
  isChecking: boolean
  initialUrl?: string
  initialBranch?: string
}>()

const emit = defineEmits<{
  'update:selection': [value: { url: string; name: string; branch: string }]
  'url-valid': [valid: boolean]
  'branches-loaded': [loaded: boolean]
}>()

const eventBus = useEventBus()

const publicRepoUrl = ref(props.initialUrl ?? '')
const publicRepoError = ref<string | null>(null)
const publicBranches = ref<Branch[]>([])
const publicDefaultBranch = ref<string>('')
const publicBranch = ref('')
const isLoadingPublicBranches = ref(false)
const publicBranchesError = ref<string | null>(null)

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/)?$/)
  if (!match) return null
  return { owner: match[1]!, repo: match[2]! }
}

// Watch URL changes to validate and reset state
watch(publicRepoUrl, () => {
  publicRepoError.value = null
  publicBranches.value = []
  publicBranch.value = ''
  publicDefaultBranch.value = ''
  publicBranchesError.value = null

  emit('update:selection', { url: '', name: '', branch: '' })
  emit('branches-loaded', false)

  const url = publicRepoUrl.value.trim()
  if (!url) {
    emit('url-valid', false)
    return
  }

  const parsed = parseGitHubUrl(url)
  if (!parsed) {
    publicRepoError.value = 'Invalid GitHub URL. Expected format: https://github.com/owner/repo'
    emit('url-valid', false)
    return
  }

  emit('url-valid', true)
})

async function checkRepository() {
  const url = publicRepoUrl.value.trim()
  const parsed = parseGitHubUrl(url)
  if (!parsed) return

  try {
    isLoadingPublicBranches.value = true
    publicBranchesError.value = null
    publicBranches.value = []

    const teamId = eventBus.getState<string>('selected_team_id')
    if (!teamId) {
      throw new Error('No team selected')
    }

    const response = await DeploymentService.getPublicBranches(teamId, parsed.owner, parsed.repo)
    publicBranches.value = response.branches
    publicDefaultBranch.value = response.default_branch
    publicBranch.value = response.default_branch

    emit('branches-loaded', true)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load branches'
    publicBranchesError.value = errorMessage
    emit('branches-loaded', false)
  } finally {
    isLoadingPublicBranches.value = false
  }
}

// Watch branch selection to emit selection updates
watch(publicBranch, () => {
  const url = publicRepoUrl.value.trim()
  const parsed = parseGitHubUrl(url)

  if (parsed && publicBranch.value) {
    emit('update:selection', {
      url: `https://github.com/${parsed.owner}/${parsed.repo}`,
      name: `${parsed.owner}/${parsed.repo}`,
      branch: publicBranch.value
    })
  } else {
    emit('update:selection', { url: '', name: '', branch: '' })
  }
})

onMounted(async () => {
  if (props.initialUrl) {
    const parsed = parseGitHubUrl(props.initialUrl)
    if (parsed) {
      emit('url-valid', true)
      try {
        isLoadingPublicBranches.value = true
        publicBranchesError.value = null

        const teamId = eventBus.getState<string>('selected_team_id')
        if (!teamId) return

        const response = await DeploymentService.getPublicBranches(teamId, parsed.owner, parsed.repo)
        publicBranches.value = response.branches
        publicDefaultBranch.value = response.default_branch

        // Restore previously selected branch, or fall back to default
        const branchToSelect = props.initialBranch && response.branches.some(b => b.name === props.initialBranch)
          ? props.initialBranch
          : response.default_branch
        publicBranch.value = branchToSelect

        emit('branches-loaded', true)
      } catch {
        // Silently fail — user can manually re-check
        emit('branches-loaded', false)
      } finally {
        isLoadingPublicBranches.value = false
      }
    }
  }
})

defineExpose({
  checkRepository
})
</script>

<template>
  <div class="space-y-4">
    <!-- URL Input -->
    <div class="space-y-2">
      <Label for="public-repo-url">GitHub Repository URL</Label>
      <Input
        id="public-repo-url"
        v-model="publicRepoUrl"
        placeholder="https://github.com/owner/repo"
      />
      <p v-if="publicRepoError" class="text-sm text-destructive">{{ publicRepoError }}</p>
      <p v-else class="text-xs text-muted-foreground">
        Paste the URL of any public GitHub repository
      </p>
    </div>

    <!-- Loading branches -->
    <div v-if="isLoadingPublicBranches || isChecking" class="flex items-center gap-2 p-3 border rounded-lg">
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
</template>
