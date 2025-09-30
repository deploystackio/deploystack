<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Github, GitBranch, Globe } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import type { McpServerFormData } from '../../../views/admin/mcp-server-catalog/types'

interface Props {
  modelValue: McpServerFormData['repository_setup']
  formData: McpServerFormData
}

interface Emits {
  (e: 'update:modelValue', value: McpServerFormData['repository_setup']): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const eventBus = useEventBus()

// Storage key for this step - matches what the wizard uses
const STORAGE_KEY = 'edit_repository_setup_data'

// Form state from storage
const repositoryUrl = ref('')
const repositorySource = ref('')
const gitBranch = ref('main')
const validationError = ref<string | null>(null)

// Load data from storage on mount
const loadFromStorage = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stored = eventBus.getState<any>(STORAGE_KEY)
  if (stored) {
    repositoryUrl.value = stored.repository_url || ''
    repositorySource.value = stored.repository_source || ''
    gitBranch.value = stored.git_branch || 'main'
  } else if (props.modelValue) {
    repositoryUrl.value = props.modelValue.repository_url || ''
    repositorySource.value = props.modelValue.repository_source || ''
    gitBranch.value = props.modelValue.git_branch || 'main'
  }
}

// Save data to storage
const saveToStorage = () => {
  const data = {
    repository_url: repositoryUrl.value,
    repository_source: repositorySource.value,
    git_branch: gitBranch.value,
    auto_populated: false
  }
  eventBus.setState(STORAGE_KEY, data)
  emit('update:modelValue', data)
}

// Get supported platforms
const supportedPlatforms = McpCatalogService.getSupportedPlatforms()

// Auto-detect platform from URL
const detectedPlatform = computed(() => {
  if (!repositoryUrl.value) return null
  const parsed = McpCatalogService.parseRepositoryUrl(repositoryUrl.value)
  return parsed ? supportedPlatforms.find(p => p.value === parsed.source) : null
})


// Get icon for platform
const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'github':
      return Github
    case 'gitlab':
    case 'bitbucket':
      return GitBranch
    default:
      return Globe
  }
}

// Validate repository URL
const validateRepository = () => {
  if (!repositoryUrl.value) {
    validationError.value = null
    repositorySource.value = ''
    updateParent()
    return
  }

  const parsed = McpCatalogService.parseRepositoryUrl(repositoryUrl.value)

  if (!parsed) {
    validationError.value = 'Please enter a valid repository URL from GitHub, GitLab, or Bitbucket'
    repositorySource.value = ''
    updateParent()
    return
  }

  // Auto-set the detected platform
  repositorySource.value = parsed.source
  validationError.value = null
  updateParent()
}

// Update parent component
const updateParent = () => {
  saveToStorage()
}

// Watch for changes and auto-save to storage
watch([repositoryUrl, repositorySource, gitBranch], () => {
  if (repositoryUrl.value) {
    validateRepository()
  } else {
    saveToStorage()
  }
})

// Initialize on mount
onMounted(() => {
  loadFromStorage()
  validateRepository()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold mb-2">Repository Configuration</h2>
      <p class="text-muted-foreground">
        Configure the repository where your MCP server is hosted
      </p>
    </div>

    <div class="space-y-4">
      <!-- Repository URL -->
      <div class="space-y-2">
        <Label for="repository-url">Repository URL *</Label>
        <Input
          id="repository-url"
          v-model="repositoryUrl"
          type="url"
          placeholder="https://github.com/owner/repository"
          @blur="validateRepository"
        />
        <p class="text-sm text-muted-foreground">
          Enter a repository URL from GitHub, GitLab, or Bitbucket
        </p>
      </div>

      <!-- Platform Detection Display -->
      <div v-if="detectedPlatform" class="flex items-center gap-2">
        <Badge variant="secondary" class="flex items-center gap-1">
          <component :is="getPlatformIcon(detectedPlatform.value)" class="h-3 w-3" />
          {{ detectedPlatform.label }}
        </Badge>
        <span class="text-sm text-muted-foreground">Platform auto-detected</span>
      </div>

      <!-- Manual Platform Selection (if needed) -->
      <div v-if="repositoryUrl && !detectedPlatform" class="space-y-2">
        <Label for="repository-source">Repository Platform *</Label>
        <Select v-model="repositorySource">
          <SelectTrigger>
            <SelectValue placeholder="Select repository platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="platform in supportedPlatforms"
              :key="platform.value"
              :value="platform.value"
            >
              <div class="flex items-center gap-2">
                <component :is="getPlatformIcon(platform.value)" class="h-4 w-4" />
                {{ platform.label }}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Git Branch -->
      <div class="space-y-2">
        <Label for="git-branch">Git Branch</Label>
        <Input
          id="git-branch"
          v-model="gitBranch"
          placeholder="main"
        />
        <p class="text-sm text-muted-foreground">
          Specify the branch to use (defaults to 'main')
        </p>
      </div>
    </div>

    <!-- Validation Error -->
    <Alert v-if="validationError" variant="destructive">
      <AlertDescription>{{ validationError }}</AlertDescription>
    </Alert>

    <!-- Supported Platforms Info -->
    <div class="rounded-lg border p-4 bg-muted/30">
      <h4 class="font-medium mb-2">Supported Platforms</h4>
      <div class="flex flex-wrap gap-2">
        <Badge
          v-for="platform in supportedPlatforms"
          :key="platform.value"
          variant="outline"
          class="flex items-center gap-1"
        >
          <component :is="getPlatformIcon(platform.value)" class="h-3 w-3" />
          {{ platform.label }}
        </Badge>
      </div>
      <p class="text-sm text-muted-foreground mt-2">
        DeployStack supports MCP servers hosted on these Git platforms
      </p>
    </div>
  </div>
</template>
