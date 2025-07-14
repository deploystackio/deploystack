<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
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
import { FileText, Github, Settings, Loader2 } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import GitHubRepositoryStep from '@/components/admin/mcp-catalog/GitHubRepositoryStep.vue'
import ClaudeDesktopConfigStep from '@/components/admin/mcp-catalog/ClaudeDesktopConfigStep.vue'
import BasicInfoStep from '@/components/admin/mcp-catalog/BasicInfoStep.vue'
import type { McpServerFormData } from '@/views/admin/mcp-server-catalog/types'

// Props interface
interface Props {
  submitButtonText?: string
  cancelButtonText?: string
}

const props = withDefaults(defineProps<Props>(), {
  submitButtonText: '',
  cancelButtonText: ''
})

// Emits
const emit = defineEmits<{
  submit: [formData: McpServerAddFormData]
  cancel: []
  stepChanged: [data: { step: number; stepKey: string }]
  githubDataPopulated: [githubData: Record<string, unknown>]
}>()

const { t } = useI18n()
const eventBus = useEventBus()

// Form data interface for add wizard
interface McpServerAddFormData {
  github: {
    github_url: string
    git_branch: string
    auto_populated: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repo_data?: any
  }
  claudeConfig: {
    claude_desktop_config: object
    raw_json: string
  }
  basic: {
    name: string
    description: string
    long_description: string
    category_id: string
    author_name: string
    author_contact: string
    organization: string
    license: string
    tags: string[]
  }
}

// Form steps configuration
const steps = [
  {
    key: 'github' as const,
    label: t('mcpCatalog.form.steps.github'),
    icon: Github,
    component: GitHubRepositoryStep
  },
  {
    key: 'claudeConfig' as const,
    label: t('mcpCatalog.form.steps.claudeConfig'),
    icon: Settings,
    component: ClaudeDesktopConfigStep
  },
  {
    key: 'basic' as const,
    label: t('mcpCatalog.form.steps.basic'),
    icon: FileText,
    component: BasicInfoStep
  }
]

// State
const currentStep = ref(0)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const isFetchingGitHub = ref(false)
const githubFetchError = ref<string | null>(null)

// Form data with proper initialization
const formData = ref<McpServerAddFormData>({
  github: {
    github_url: '',
    git_branch: 'main',
    auto_populated: false
  },
  claudeConfig: {
    claude_desktop_config: {},
    raw_json: ''
  },
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
  }
})

// Create compatible form data for existing components
const compatibleFormData = computed((): McpServerFormData => ({
  basic: formData.value.basic,
  repository: {
    github_url: formData.value.github.github_url,
    git_branch: formData.value.github.git_branch,
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
  github: formData.value.github,
  review: {}
}))

// Computed properties
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

const canProceedFromClaudeConfig = computed(() => {
  return formData.value.claudeConfig.claude_desktop_config &&
         Object.keys(formData.value.claudeConfig.claude_desktop_config).length > 0
})

const canSubmit = computed(() => {
  return formData.value.basic.name &&
         formData.value.basic.description &&
         formData.value.github.github_url &&
         canProceedFromClaudeConfig.value
})

// Dynamic button text based on props or defaults
const submitText = computed(() => {
  if (props.submitButtonText) return props.submitButtonText
  if (isSubmitting.value) {
    return t('mcpCatalog.form.navigation.creating')
  }
  return t('mcpCatalog.form.navigation.submit')
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

  try {
    isFetchingGitHub.value = true
    githubFetchError.value = null

    const githubUrl = formData.value.github.github_url

    // Call backend API to fetch GitHub data
    const response = await McpCatalogService.getGitHubRepoInfo(githubUrl)

    if (response.success && response.data) {
      // Auto-populate basic info from GitHub data
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

// Auto-population function for GitHub data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const autoPopulateFromGitHub = (githubData: any) => {
  // Update GitHub data
  formData.value.github = {
    ...formData.value.github,
    auto_populated: true,
    repo_data: githubData
  }

  // Auto-populate basic info
  formData.value.basic = {
    ...formData.value.basic,
    name: githubData.name || '',
    description: githubData.description || '',
    long_description: githubData.readme_content || githubData.description || '',
    author_name: githubData.owner?.login || githubData.author_name || '',
    author_contact: githubData.owner?.email || githubData.author_contact || '',
    organization: githubData.owner?.type === 'Organization' ? githubData.owner.login : (githubData.organization || ''),
    license: githubData.license?.spdx_id || githubData.license || '',
    tags: githubData.topics || githubData.tags || []
  }
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

// Form persistence using event bus
const saveFormData = () => {
  eventBus.emit('mcp-add-form-data-updated', {
    step: currentStep.value,
    data: formData.value
  })
}

const loadFormData = () => {
  // Try to load persisted form data
  // This would be implemented with localStorage or session storage
  // For now, we'll keep the default empty form
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
      <!-- GitHub Step -->
      <GitHubRepositoryStep
        v-if="currentStep === 0"
        v-model="formData.github"
        :form-data="compatibleFormData"
      />

      <!-- Claude Config Step -->
      <ClaudeDesktopConfigStep
        v-else-if="currentStep === 1"
        v-model="formData.claudeConfig"
      />

      <!-- Basic Info Step -->
      <BasicInfoStep
        v-else-if="currentStep === 2"
        v-model="formData.basic"
        :form-data="compatibleFormData"
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
          {{ isFetchingGitHub ? t('mcpCatalog.form.navigation.fetching') : t('mcpCatalog.form.navigation.next') }}
        </Button>

        <!-- Normal next button for Claude config step -->
        <Button
          v-else-if="currentStep === 1"
          @click="nextStep"
          :disabled="!canProceedFromClaudeConfig"
        >
          {{ t('mcpCatalog.form.navigation.next') }}
        </Button>

        <!-- Submit button for final step -->
        <Button
          v-else
          @click="submitForm"
          :disabled="!canSubmit || isSubmitting"
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
        <span class="text-sm">{{ t('mcpCatalog.validation.githubUrlInvalid') }}</span>
      </AlertDescription>
    </Alert>
  </div>
</template>
