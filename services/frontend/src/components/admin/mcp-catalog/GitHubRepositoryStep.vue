<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { McpServerFormData } from '../../../views/admin/mcp-server-catalog/types'

interface RepositoryData {
  repository_url: string
  repository_source: string
  git_branch: string
  auto_populated: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repo_data?: any
}

interface Props {
  modelValue: RepositoryData
  formData: McpServerFormData
}

interface Emits {
  (e: 'update:modelValue', value: RepositoryData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Simple state - just URL and validation
const repositoryUrl = ref(props.modelValue?.repository_url || '')
const validationError = ref<string | null>(null)

// Basic repository URL validation (supports any Git platform)
const isValidRepositoryUrl = computed(() => {
  if (!repositoryUrl.value) return false
  // Basic validation - check if it looks like a repository URL
  return repositoryUrl.value.length > 0 && repositoryUrl.value.includes('/')
})

// Validate URL format
const validateUrl = () => {
  if (!repositoryUrl.value) {
    validationError.value = null
    return
  }

  if (!isValidRepositoryUrl.value) {
    validationError.value = 'Please enter a valid repository URL'
    return
  }

  validationError.value = null

  // Detect repository source from URL
  let source = 'github'
  if (repositoryUrl.value.includes('github.com')) {
    source = 'github'
  } else if (repositoryUrl.value.includes('gitlab.com')) {
    source = 'gitlab'
  } else if (repositoryUrl.value.includes('bitbucket.org')) {
    source = 'bitbucket'
  }

  // Update parent component
  emit('update:modelValue', {
    repository_url: repositoryUrl.value,
    repository_source: source,
    git_branch: 'main', // Default branch
    auto_populated: false
  })
}

// Watch for changes
watch(repositoryUrl, validateUrl)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold mb-2">GitHub Repository</h2>
      <p class="text-muted-foreground">
        Enter the GitHub repository URL for your MCP server
      </p>
    </div>

    <div class="space-y-2">
      <Label for="repository-url">Repository URL *</Label>
      <Input
        id="repository-url"
        v-model="repositoryUrl"
        type="url"
        placeholder="https://github.com/owner/repository"
        @blur="validateUrl"
      />
      <p class="text-sm text-muted-foreground">
        Enter a valid repository URL (GitHub, GitLab, Bitbucket, etc.)
      </p>
    </div>

    <!-- Validation Error -->
    <Alert v-if="validationError" variant="destructive">
      <AlertDescription>{{ validationError }}</AlertDescription>
    </Alert>
  </div>
</template>
