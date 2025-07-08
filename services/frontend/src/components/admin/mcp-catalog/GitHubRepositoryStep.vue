<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Github, Star, GitFork, ExternalLink, RefreshCw } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import type { McpServerFormData } from '../../../views/admin/mcp-server-catalog/types'

interface Props {
  modelValue: McpServerFormData['github']
  formData: McpServerFormData
}

interface Emits {
  (e: 'update:modelValue', value: McpServerFormData['github']): void
  (e: 'update:formData', value: McpServerFormData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

// Local state
const githubUrl = ref(props.modelValue?.github_url || '')
const gitBranch = ref(props.modelValue?.git_branch || 'main')
const isLoading = ref(false)
const error = ref<string | null>(null)
const repoData = ref<any>(null)
const hasAutoPopulated = ref(false)

// Computed
const isValidGitHubUrl = computed(() => {
  return githubUrl.value.includes('github.com') && githubUrl.value.includes('/')
})

const canFetch = computed(() => {
  return isValidGitHubUrl.value && !isLoading.value
})

// Methods
const validateUrl = () => {
  if (!githubUrl.value) {
    error.value = null
    return
  }

  if (!isValidGitHubUrl.value) {
    error.value = 'Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)'
    return
  }

  error.value = null
}

const fetchRepositoryInfo = async () => {
  if (!canFetch.value) return

  try {
    isLoading.value = true
    error.value = null

    const response = await McpCatalogService.getGitHubRepoInfo(githubUrl.value, gitBranch.value)

    if (response.success && response.data) {
      repoData.value = response.data
      hasAutoPopulated.value = true

      // Auto-populate form data
      autoPopulateFormData(response.data)

      // Update the current step data
      emit('update:modelValue', {
        github_url: githubUrl.value,
        git_branch: gitBranch.value,
        auto_populated: true,
        repo_data: response.data
      })
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch repository information'
    repoData.value = null
    hasAutoPopulated.value = false
  } finally {
    isLoading.value = false
  }
}

const autoPopulateFormData = (data: any) => {
  // Create updated form data with auto-populated values
  const updatedFormData: McpServerFormData = {
    ...props.formData,
    basic: {
      ...props.formData.basic,
      name: data.name || props.formData.basic.name,
      description: data.description || props.formData.basic.description,
      author_name: data.author_name || props.formData.basic.author_name,
      organization: data.organization || props.formData.basic.organization,
      license: data.license || props.formData.basic.license,
      tags: data.tags?.length > 0 ? data.tags : props.formData.basic.tags
    },
    repository: {
      ...props.formData.repository,
      github_url: githubUrl.value,
      git_branch: gitBranch.value,
      homepage_url: data.homepage_url || props.formData.repository.homepage_url
    },
    technical: {
      ...props.formData.technical,
      language: data.language || props.formData.technical.language,
      runtime: data.runtime || props.formData.technical.runtime,
      runtime_min_version: data.runtime_min_version || props.formData.technical.runtime_min_version,
      installation_methods: data.installation_methods?.length > 0 ? data.installation_methods : props.formData.technical.installation_methods,
      dependencies: data.dependencies ? JSON.stringify(data.dependencies, null, 2) : props.formData.technical.dependencies
    },
    github: {
      github_url: githubUrl.value,
      git_branch: gitBranch.value,
      auto_populated: true,
      repo_data: data
    }
  }

  // Emit the updated form data
  emit('update:formData', updatedFormData)
}

const refreshData = () => {
  if (repoData.value) {
    fetchRepositoryInfo()
  }
}

// Watch for URL changes
watch(githubUrl, validateUrl)

// Auto-fetch when URL is pasted/entered
watch(githubUrl, (newUrl) => {
  if (isValidGitHubUrl.value && newUrl !== props.modelValue?.github_url) {
    // Debounce the fetch
    setTimeout(() => {
      if (githubUrl.value === newUrl && isValidGitHubUrl.value) {
        fetchRepositoryInfo()
      }
    }, 1000)
  }
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold mb-2">{{ t('mcpCatalog.form.github.title') }}</h2>
      <p class="text-muted-foreground">
        {{ t('mcpCatalog.form.github.description') }}
      </p>
    </div>

    <!-- GitHub URL Input -->
    <div class="space-y-4">
      <div class="space-y-2">
        <Label for="github-url">{{ t('mcpCatalog.form.github.url.label') }} *</Label>
        <div class="flex gap-2">
          <Input
            id="github-url"
            v-model="githubUrl"
            type="url"
            :placeholder="t('mcpCatalog.form.github.url.placeholder')"
            :disabled="isLoading"
            class="flex-1"
            @blur="validateUrl"
          />
          <Button
            @click="fetchRepositoryInfo"
            :disabled="!canFetch"
            size="default"
            class="flex items-center gap-2"
          >
            <Loader2 v-if="isLoading" class="h-4 w-4 animate-spin" />
            <Github v-else class="h-4 w-4" />
            {{ isLoading ? 'Fetching...' : 'Fetch Info' }}
          </Button>
        </div>
        <p class="text-sm text-muted-foreground">
          {{ t('mcpCatalog.form.github.url.help') }}
        </p>
      </div>

      <!-- Branch Input -->
      <div class="space-y-2">
        <Label for="git-branch">{{ t('mcpCatalog.form.github.branch.label') }}</Label>
        <Input
          id="git-branch"
          v-model="gitBranch"
          :placeholder="t('mcpCatalog.form.github.branch.placeholder')"
          :disabled="isLoading"
        />
        <p class="text-sm text-muted-foreground">
          {{ t('mcpCatalog.form.github.branch.help') }}
        </p>
      </div>
    </div>

    <!-- Error Message -->
    <Alert v-if="error" variant="destructive">
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <!-- Repository Information Preview -->
    <Card v-if="repoData" class="border-green-200 bg-green-50">
      <CardHeader class="pb-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Github class="h-5 w-5 text-green-600" />
            <CardTitle class="text-green-800">{{ t('mcpCatalog.form.github.preview.title') }}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            @click="refreshData"
            class="text-green-600 hover:text-green-700"
          >
            <RefreshCw class="h-4 w-4" />
          </Button>
        </div>
        <CardDescription class="text-green-700">
          {{ t('mcpCatalog.form.github.preview.description') }}
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- Repository Basic Info -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 class="font-medium text-green-800 mb-2">{{ t('mcpCatalog.form.github.preview.basic') }}</h4>
            <div class="space-y-1 text-sm">
              <div><strong>Name:</strong> {{ repoData.name }}</div>
              <div><strong>Description:</strong> {{ repoData.description || 'No description' }}</div>
              <div><strong>Language:</strong> {{ repoData.language }}</div>
              <div><strong>License:</strong> {{ repoData.license || 'Not specified' }}</div>
            </div>
          </div>

          <div>
            <h4 class="font-medium text-green-800 mb-2">{{ t('mcpCatalog.form.github.preview.stats') }}</h4>
            <div class="flex items-center gap-4 text-sm">
              <div class="flex items-center gap-1">
                <Star class="h-4 w-4" />
                <span>{{ repoData.stars }}</span>
              </div>
              <div class="flex items-center gap-1">
                <GitFork class="h-4 w-4" />
                <span>{{ repoData.forks }}</span>
              </div>
              <div v-if="repoData.latest_version" class="flex items-center gap-1">
                <Badge variant="secondary">{{ repoData.latest_version }}</Badge>
              </div>
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="repoData.tags?.length > 0">
          <h4 class="font-medium text-green-800 mb-2">{{ t('mcpCatalog.form.github.preview.tags') }}</h4>
          <div class="flex flex-wrap gap-1">
            <Badge v-for="tag in repoData.tags" :key="tag" variant="outline" class="text-xs">
              {{ tag }}
            </Badge>
          </div>
        </div>

        <!-- Installation Methods -->
        <div v-if="repoData.installation_methods?.length > 0">
          <h4 class="font-medium text-green-800 mb-2">{{ t('mcpCatalog.form.github.preview.installation') }}</h4>
          <div class="space-y-1">
            <div v-for="method in repoData.installation_methods" :key="method.type" class="text-sm">
              <Badge variant="outline" class="mr-2">{{ method.type }}</Badge>
              <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{{ method.command }}</code>
            </div>
          </div>
        </div>

        <!-- Links -->
        <div class="flex items-center gap-4 pt-2 border-t border-green-200">
          <a
            :href="repoData.github_url"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
          >
            <Github class="h-4 w-4" />
            View Repository
            <ExternalLink class="h-3 w-3" />
          </a>
          <a
            v-if="repoData.homepage_url"
            :href="repoData.homepage_url"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
          >
            Homepage
            <ExternalLink class="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>

    <!-- Success Message -->
    <Alert v-if="hasAutoPopulated" class="border-green-200 bg-green-50">
      <AlertDescription class="text-green-800">
        {{ t('mcpCatalog.form.github.success') }}
      </AlertDescription>
    </Alert>
  </div>
</template>
