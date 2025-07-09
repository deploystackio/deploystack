<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { McpServerFormData } from '../../../views/admin/mcp-server-catalog/types'

interface Props {
  modelValue: McpServerFormData['github']
  formData: McpServerFormData
}

interface Emits {
  (e: 'update:modelValue', value: McpServerFormData['github']): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Simple state - just URL and validation
const githubUrl = ref(props.modelValue?.github_url || '')
const validationError = ref<string | null>(null)

// Basic GitHub URL validation
const isValidGitHubUrl = computed(() => {
  if (!githubUrl.value) return false
  return githubUrl.value.includes('github.com') && githubUrl.value.includes('/')
})

// Validate URL format
const validateUrl = () => {
  if (!githubUrl.value) {
    validationError.value = null
    return
  }

  if (!isValidGitHubUrl.value) {
    validationError.value = 'Please enter a valid GitHub repository URL'
    return
  }

  validationError.value = null

  // Update parent component
  emit('update:modelValue', {
    github_url: githubUrl.value,
    git_branch: 'main', // Default branch
    auto_populated: false
  })
}

// Watch for changes
watch(githubUrl, validateUrl)
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
      <Label for="github-url">Repository URL *</Label>
      <Input
        id="github-url"
        v-model="githubUrl"
        type="url"
        placeholder="https://github.com/owner/repository"
        @blur="validateUrl"
      />
      <p class="text-sm text-muted-foreground">
        Enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)
      </p>
    </div>

    <!-- Validation Error -->
    <Alert v-if="validationError" variant="destructive">
      <AlertDescription>{{ validationError }}</AlertDescription>
    </Alert>
  </div>
</template>
