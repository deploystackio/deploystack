<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Github, Code, Zap, CheckCircle, Loader2 } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import BasicInfoStep from '@/components/admin/mcp-catalog/BasicInfoStep.vue'
import TechnicalStep from '@/components/admin/mcp-catalog/TechnicalStep.vue'
import CapabilitiesStep from '@/components/admin/mcp-catalog/CapabilitiesStep.vue'
import GitHubRepositoryStep from '@/components/admin/mcp-catalog/GitHubRepositoryStep.vue'
import ReviewStep from '@/components/admin/mcp-catalog/ReviewStep.vue'
import type {
  McpServerFormData
} from '@/views/admin/mcp-server-catalog/types'

// Props interface
interface Props {
  mode?: 'create' | 'edit'
  initialData?: Partial<McpServerFormData>
  submitButtonText?: string
  cancelButtonText?: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  submitButtonText: '',
  cancelButtonText: ''
})

// Emits
const emit = defineEmits<{
  submit: [formData: McpServerFormData]
  cancel: []
  stepChanged: [data: { step: number; stepKey: string }]
  githubDataPopulated: [githubData: Record<string, unknown>]
}>()

const { t } = useI18n()
const eventBus = useEventBus()

// Form steps configuration
const steps = [
  {
    key: 'github' as const,
    label: t('mcpCatalog.form.steps.github'),
    icon: Github,
    component: GitHubRepositoryStep
  },
  {
    key: 'basic' as const,
    label: t('mcpCatalog.form.steps.basic'),
    icon: FileText,
    component: BasicInfoStep
  },
  {
    key: 'technical' as const,
    label: t('mcpCatalog.form.steps.technical'),
    icon: Code,
    component: TechnicalStep
  },
  {
    key: 'capabilities' as const,
    label: t('mcpCatalog.form.steps.capabilities'),
    icon: Zap,
    component: CapabilitiesStep
  },
  {
    key: 'review' as const,
    label: t('mcpCatalog.form.steps.review'),
    icon: CheckCircle,
    component: ReviewStep
  }
]

// State
const currentStep = ref(0)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const isFetchingGitHub = ref(false)
const githubFetchError = ref<string | null>(null)

// Form data with proper initialization
const formData = ref<McpServerFormData>({
  basic: {
    name: '',
    description: '',
    long_description: '',
    category_id: '',
    author_name: '',
    author_contact: '',
    organization: '',
    license: '',
    tags: []
  },
  repository: {
    github_url: '',
    git_branch: 'main',
    homepage_url: ''
  },
  technical: {
    language: '',
    runtime: '',
    runtime_min_version: '',
    installation_methods: [],
    dependencies: ''
  },
  capabilities: {
    tools: [],
    resources: [],
    prompts: [],
    environment_variables: [],
    default_config: ''
  },
  github: {
    github_url: '',
    git_branch: 'main',
    auto_populated: false
  },
  review: {}
})

// Watch for changes in initialData and update formData reactively
watch(
  () => props.initialData,
  (newInitialData) => {
    if (newInitialData) {
      // In edit mode, use deep merge to ensure nested objects are properly merged
      // For capabilities, we need to completely replace the default empty arrays with API data
      formData.value = {
        ...formData.value,
        basic: { ...formData.value.basic, ...newInitialData.basic },
        repository: { ...formData.value.repository, ...newInitialData.repository },
        technical: { ...formData.value.technical, ...newInitialData.technical },
        capabilities: newInitialData.capabilities ? newInitialData.capabilities : formData.value.capabilities,
        github: { ...formData.value.github, ...newInitialData.github },
        review: { ...formData.value.review, ...newInitialData.review }
      }
    }
  },
  { immediate: true, deep: true }
)

// Computed properties
const currentStepData = computed(() => steps[currentStep.value])
const isFirstStep = computed(() => currentStep.value === 0)
const isLastStep = computed(() => currentStep.value === steps.length - 1)
const canGoNext = computed(() => !isLastStep.value)
const canGoPrevious = computed(() => !isFirstStep.value)

const canProceedFromGitHub = computed(() => {
  const githubUrl = formData.value.github.github_url
  return githubUrl &&
         githubUrl.includes('github.com') &&
         githubUrl.includes('/') &&
         !isFetchingGitHub.value
})

// Dynamic button text based on props or defaults
const submitText = computed(() => {
  if (props.submitButtonText) return props.submitButtonText
  if (isSubmitting.value) {
    return props.mode === 'edit' ? t('mcpCatalog.form.navigation.updating') : t('mcpCatalog.form.navigation.creating')
  }
  return props.mode === 'edit' ? t('mcpCatalog.form.navigation.update') : t('mcpCatalog.form.navigation.submit')
})

const cancelText = computed(() => {
  return props.cancelButtonText || t('mcpCatalog.form.navigation.cancel')
})

// Navigation methods
const goToStep = (stepIndex: number) => {
  if (stepIndex >= 0 && stepIndex < currentStep.value) {
    const oldStep = currentStep.value
    currentStep.value = stepIndex
    emit('stepChanged', { step: stepIndex, stepKey: steps[stepIndex].key })

    // Emit event bus event for other components
    eventBus.emit('mcp-form-step-changed', {
      from: oldStep,
      to: stepIndex,
      stepKey: steps[stepIndex].key
    })
  }
}

const nextStep = () => {
  if (canGoNext.value) {
    const oldStep = currentStep.value
    currentStep.value++
    emit('stepChanged', { step: currentStep.value, stepKey: steps[currentStep.value].key })

    // Emit event bus event
    eventBus.emit('mcp-form-step-changed', {
      from: oldStep,
      to: currentStep.value,
      stepKey: steps[currentStep.value].key
    })
  }
}

const previousStep = () => {
  if (canGoPrevious.value) {
    const oldStep = currentStep.value
    currentStep.value--
    emit('stepChanged', { step: currentStep.value, stepKey: steps[currentStep.value].key })

    // Emit event bus event
    eventBus.emit('mcp-form-step-changed', {
      from: oldStep,
      to: currentStep.value,
      stepKey: steps[currentStep.value].key
    })
  }
}

const handleCancel = () => {
  emit('cancel')
}

// GitHub step navigation with auto-population
const handleGitHubStepNext = async () => {
  if (currentStep.value !== 0) return

  // In edit mode, skip GitHub auto-population and just go to next step
  if (props.mode === 'edit') {
    nextStep()
    return
  }

  try {
    isFetchingGitHub.value = true
    githubFetchError.value = null

    const githubUrl = formData.value.github.github_url

    // Call backend API to fetch GitHub data
    const response = await McpCatalogService.getGitHubRepoInfo(githubUrl)

    if (response.success && response.data) {
      // Auto-populate all form data
      autoPopulateFromGitHub(response.data)

      // Emit events
      emit('githubDataPopulated', response.data)
      eventBus.emit('mcp-github-data-populated', response.data)

      // Advance to next step
      nextStep()
    } else {
      throw new Error(response.message || 'Failed to fetch repository information')
    }
  } catch (error) {
    githubFetchError.value = error instanceof Error ? error.message : 'Failed to fetch repository data'
    // Stay on current step - user must retry
  } finally {
    isFetchingGitHub.value = false
  }
}

// Enhanced auto-population function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const autoPopulateFromGitHub = (githubData: any) => {
  formData.value = {
    ...formData.value,
    basic: {
      name: githubData.name || '',
      description: githubData.description || '',
      long_description: githubData.readme_content || githubData.description || '',
      category_id: formData.value.basic.category_id, // Keep user selection
      author_name: githubData.owner?.login || githubData.author_name || '',
      author_contact: githubData.owner?.email || githubData.author_contact || '',
      organization: githubData.owner?.type === 'Organization' ? githubData.owner.login : (githubData.organization || ''),
      license: githubData.license?.spdx_id || githubData.license || '',
      tags: githubData.topics || githubData.tags || []
    },
    repository: {
      github_url: githubData.html_url || githubData.github_url || formData.value.github.github_url,
      git_branch: githubData.default_branch || 'main',
      homepage_url: githubData.homepage || githubData.homepage_url || ''
    },
    technical: {
      language: githubData.language || '',
      runtime: detectRuntime(githubData.language || ''),
      runtime_min_version: githubData.runtime_min_version || '',
      installation_methods: githubData.installation_methods || parseInstallationMethods(githubData),
      dependencies: githubData.dependencies ? JSON.stringify(githubData.dependencies, null, 2) : ''
    },
    capabilities: {
      tools: githubData.mcp_tools || githubData.tools || [],
      resources: githubData.mcp_resources || githubData.resources || [],
      prompts: githubData.mcp_prompts || githubData.prompts || [],
      environment_variables: githubData.mcp_env_vars || githubData.environment_variables || [],
      default_config: githubData.mcp_config ? JSON.stringify(githubData.mcp_config, null, 2) : (githubData.default_config || '')
    },
    github: {
      github_url: githubData.html_url || githubData.github_url || formData.value.github.github_url,
      git_branch: githubData.default_branch || 'main',
      auto_populated: true,
      repo_data: githubData
    }
  }
}

// Helper functions
const detectRuntime = (language: string): string => {
  const runtimeMap: Record<string, string> = {
    'JavaScript': 'node',
    'TypeScript': 'node',
    'Python': 'python',
    'Go': 'go',
    'Rust': 'rust',
    'Java': 'java',
    'C#': 'dotnet',
    'Ruby': 'ruby',
    'PHP': 'php'
  }
  return runtimeMap[language] || ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseInstallationMethods = (githubData: any): string[] => {
  const methods: string[] = []

  // Check for common package files
  if (githubData.has_package_json || githubData.language === 'JavaScript' || githubData.language === 'TypeScript') {
    methods.push('npm')
  }
  if (githubData.has_requirements_txt || githubData.has_pyproject_toml || githubData.language === 'Python') {
    methods.push('pip')
  }
  if (githubData.has_dockerfile) {
    methods.push('docker')
  }
  if (githubData.has_go_mod || githubData.language === 'Go') {
    methods.push('go')
  }

  return methods.length > 0 ? methods : ['manual']
}

// Form persistence using event bus
const saveFormData = () => {
  eventBus.emit('mcp-form-data-updated', {
    step: currentStep.value,
    data: formData.value
  })
}

const loadFormData = () => {
  // Try to load persisted form data
  // This would be implemented with localStorage or session storage
  // For now, we'll keep the default empty form
}


// Form submission
const submitForm = async () => {
  try {
    isSubmitting.value = true
    submitError.value = null

    // Emit the form data to parent component
    emit('submit', formData.value)

  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Failed to submit form'
  } finally {
    isSubmitting.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadFormData()
})

onUnmounted(() => {
  saveFormData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumb Navigation -->
    <Breadcrumb>
      <BreadcrumbList>
        <template v-for="(step, index) in steps" :key="index">
          <BreadcrumbItem>
            <!-- Current Step -->
            <BreadcrumbPage v-if="index === currentStep" class="flex items-center gap-2">
              <component :is="step.icon" class="h-4 w-4" />
              <span>{{ step.label }}</span>
            </BreadcrumbPage>

            <!-- Completed Steps (clickable) -->
            <BreadcrumbLink
              v-else-if="index < currentStep"
              @click="goToStep(index)"
              class="flex items-center gap-2 cursor-pointer hover:text-foreground"
            >
              <component :is="step.icon" class="h-4 w-4" />
              <span>{{ step.label }}</span>
            </BreadcrumbLink>

            <!-- Future Steps (disabled) -->
            <span v-else class="flex items-center gap-2 text-muted-foreground">
              <component :is="step.icon" class="h-4 w-4" />
              <span>{{ step.label }}</span>
            </span>
          </BreadcrumbItem>

          <!-- Separator -->
          <BreadcrumbSeparator v-if="index < steps.length - 1" />
        </template>
      </BreadcrumbList>
    </Breadcrumb>

    <!-- Error Message -->
    <Alert v-if="submitError" variant="destructive">
      <AlertDescription>
        {{ submitError }}
      </AlertDescription>
    </Alert>


    <!-- Step Content -->
    <div class="bg-white rounded-lg border p-6">
      <component
        :is="currentStepData.component"
        v-if="currentStepData.key === 'capabilities'"
        :form-data="formData"
        @update:form-data="(newFormData) => formData = newFormData"
      />
      <component
        :is="currentStepData.component"
        v-else
        v-model="formData[currentStepData.key]"
        :form-data="formData"
      />
    </div>

    <!-- Navigation Buttons -->
    <div class="flex items-center justify-between">
      <Button
        v-if="canGoPrevious"
        variant="outline"
        @click="previousStep"
      >
        {{ t('mcpCatalog.form.navigation.previous') }}
      </Button>
      <div v-else></div>

      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          @click="handleCancel"
        >
          {{ cancelText }}
        </Button>

        <!-- Special GitHub step button with loading -->
        <Button
          v-if="currentStep === 0"
          @click="handleGitHubStepNext"
          :disabled="!canProceedFromGitHub"
          class="min-w-[120px]"
        >
          <Loader2 v-if="isFetchingGitHub" class="h-4 w-4 animate-spin mr-2" />
          {{ isFetchingGitHub ? 'Fetching...' : t('mcpCatalog.form.navigation.next') }}
        </Button>

        <!-- Normal next button for other steps -->
        <Button
          v-else-if="canGoNext"
          @click="nextStep"
        >
          {{ t('mcpCatalog.form.navigation.next') }}
        </Button>

        <!-- Submit button for final step -->
        <Button
          v-else
          @click="submitForm"
          :disabled="isSubmitting"
        >
          {{ submitText }}
        </Button>
      </div>
    </div>

    <!-- GitHub Fetch Error (show below navigation) -->
    <Alert v-if="githubFetchError && currentStep === 0" variant="destructive" class="mt-4">
      <AlertDescription>
        {{ githubFetchError }}
        <br>
        <span class="text-sm">Please check the URL and try again.</span>
      </AlertDescription>
    </Alert>
  </div>
</template>
