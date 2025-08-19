<!--
 * STORAGE-FIRST ARCHITECTURE
 *
 * This wizard component uses a pure storage-based architecture where:
 * - All form data is stored in localStorage via the event bus
 * - Components read/write directly to storage, not through v-model props
 * - Real-time synchronization across all wizard steps
 * - No intermediate state management or prop passing
 *
 * v-model bindings are FORBIDDEN in this component.
 * Use storage-first patterns exclusively.
 -->

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ProgressBars } from '@/components/ui/progress-bars'
import { FileText, Github, Code, Zap, CheckCircle } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import ContentWrapper from '@/components/ContentWrapper.vue'
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
  serverId?: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  submitButtonText: '',
  cancelButtonText: '',
  serverId: ''
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

// Storage key for form drafts
const FORM_DRAFTS_KEY = 'mcp_edit_drafts'
const DRAFT_EXPIRY_HOURS = 24

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

// Progress steps for ProgressBars component
const progressSteps = computed(() => {
  return steps.map((step, index) => {
    let status: 'completed' | 'current' | 'pending' | 'error' = 'pending'

    if (index < currentStep.value) {
      status = 'completed'
    } else if (index === currentStep.value) {
      status = 'current'
    }

    // Check for errors
    if (index === 0 && githubFetchError.value) {
      status = 'error'
    }

    return {
      id: step.key,
      label: step.label,
      status,
      clickable: index < currentStep.value // Only completed steps are clickable
    }
  })
})

// Calculate progress percentage
const progressPercentage = computed(() => {
  // Progress should match visual step positions:
  // For 5 steps: 0%, 25%, 50%, 75%, 100%
  const totalSteps = steps.length
  if (totalSteps <= 1) return 0

  const progressIncrement = 100 / (totalSteps - 1)
  return currentStep.value * progressIncrement
})

// Progress title based on current step
const progressTitle = computed(() => {
  if (isSubmitting.value) {
    return props.mode === 'edit'
      ? t('mcpCatalog.form.navigation.updating')
      : t('mcpCatalog.form.navigation.creating')
  }
  if (isFetchingGitHub.value) {
    return t('mcpCatalog.form.navigation.fetching')
  }
  if (githubFetchError.value) {
    return t('mcpCatalog.form.errors.githubFetch')
  }

  const currentStepData = steps[currentStep.value]
  return `${currentStepData.label} - ${t('mcpCatalog.form.steps.configuring')}`
})

// Progress variant based on state
const progressVariant = computed(() => {
  if (githubFetchError.value || submitError.value) return 'destructive'
  if (isSubmitting.value) return 'default' // Keep default while submitting
  // Only show success after actual completion (would need to be handled by parent component)
  return 'default'
})

// State
const currentStep = ref(0)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const isFetchingGitHub = ref(false)
const githubFetchError = ref<string | null>(null)

// Initialize storage with form data for edit mode
const initializeStorageWithData = (data: McpServerFormData) => {
  // Initialize all storage keys that the storage-first components expect
  eventBus.setState('edit_basic_data', data.basic)
  eventBus.setState('edit_repository_data', data.repository)
  eventBus.setState('edit_technical_data', data.technical)
  eventBus.setState('edit_capabilities_data', data.capabilities)

  // Initialize Claude Desktop config if available
  if (data.technical.installation_methods && data.technical.installation_methods.length > 0) {
    const method = data.technical.installation_methods[0]
    if (method.client === 'claude-desktop') {
      const claudeConfig = {
        mcpServers: {
          [data.basic.name || 'server']: {
            command: method.command,
            args: method.args,
            env: method.env || {}
          }
        }
      }
      eventBus.setState('edit_claude_config', JSON.stringify(claudeConfig, null, 2))
    }
  }

  // Initialize environment variables
  if (data.capabilities.environment_variables) {
    eventBus.setState('capabilities_env_vars', data.capabilities.environment_variables)
  }
}

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
    tags: [],
    featured: false,
    auto_install_new_default_team: false
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
    dependencies: '',
    transport_type: 'auto'
  },
  capabilities: {
    tools: [],
    resources: [],
    prompts: [],
    environment_variables: []
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

      // CRITICAL: Initialize storage with the initial data for edit mode
      // This ensures all storage-first components have the data they need
      if (props.mode === 'edit') {
        initializeStorageWithData(formData.value)
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

// Handle step click from ProgressBars
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleStepClick = (step: any, index: number) => {
  if (step.clickable) {
    goToStep(index)
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
      category_id: '',
      author_name: githubData.owner?.login || githubData.author_name || '',
      author_contact: githubData.owner?.email || githubData.author_contact || '',
      organization: githubData.owner?.type === 'Organization' ? githubData.owner.login : (githubData.organization || ''),
      license: githubData.license?.spdx_id || githubData.license || '',
      tags: githubData.topics || githubData.tags || [],
      featured: false,
      auto_install_new_default_team: false
    },
    repository: {
      github_url: githubData.html_url || githubData.github_url || formData.value.github.github_url,
      git_branch: githubData.default_branch || 'main',
      homepage_url: githubData.homepage || githubData.homepage_url || ''
    },
    technical: {
      language: githubData.language || '',
      runtime: 'node',
      runtime_min_version: githubData.runtime_min_version || '18.0.0',
      installation_methods: githubData.installation_methods || [],
      dependencies: githubData.dependencies || '',
      transport_type: githubData.transport_type || 'auto'
    },
    capabilities: {
      tools: githubData.tools || [],
      resources: githubData.resources || [],
      prompts: githubData.prompts || [],
      environment_variables: githubData.environment_variables || []
    },
    github: {
      github_url: githubData.html_url || githubData.github_url || formData.value.github.github_url,
      git_branch: githubData.default_branch || 'main',
      auto_populated: true,
      repo_data: githubData
    }
  }
}

// Draft management functions with proper typing
interface FormDraft {
  data: McpServerFormData
  lastModified: string
  currentStep: number
}

interface FormDrafts {
  [serverId: string]: FormDraft
}

const getDrafts = (): FormDrafts => {
  return eventBus.getState<FormDrafts>(FORM_DRAFTS_KEY, {}) || {}
}

const saveDraft = () => {
  if (!props.serverId) return

  const drafts = getDrafts()
  drafts[props.serverId] = {
    data: formData.value,
    lastModified: new Date().toISOString(),
    currentStep: currentStep.value
  }

  eventBus.setState(FORM_DRAFTS_KEY, drafts)

  // Emit specific events for real-time updates
  eventBus.emit('mcp-edit-draft-updated', {
    serverId: props.serverId,
    data: formData.value,
    step: currentStep.value
  })
}

const loadDraft = (): boolean => {
  if (!props.serverId) return false

  const drafts = getDrafts()
  const draft = drafts[props.serverId]

  if (draft) {
    // Check if draft is not expired
    const draftAge = Date.now() - new Date(draft.lastModified).getTime()
    const maxAge = DRAFT_EXPIRY_HOURS * 60 * 60 * 1000

    if (draftAge < maxAge) {
      formData.value = draft.data
      currentStep.value = draft.currentStep || 0
      return true
    } else {
      // Remove expired draft
      clearDraft()
    }
  }

  return false
}

const clearDraft = () => {
  if (!props.serverId) return

  const drafts = getDrafts()
  if (drafts[props.serverId]) {
    delete drafts[props.serverId]
    eventBus.setState(FORM_DRAFTS_KEY, drafts)

    eventBus.emit('mcp-edit-draft-cleared', {
      serverId: props.serverId
    })
  }
}

const cleanupExpiredDrafts = () => {
  const drafts = getDrafts()
  const maxAge = DRAFT_EXPIRY_HOURS * 60 * 60 * 1000
  let hasChanges = false

  Object.keys(drafts).forEach(serverId => {
    const draft = drafts[serverId]
    if (draft && draft.lastModified) {
      const draftAge = Date.now() - new Date(draft.lastModified).getTime()

      if (draftAge >= maxAge) {
        delete drafts[serverId]
        hasChanges = true
      }
    }
  })

  if (hasChanges) {
    eventBus.setState(FORM_DRAFTS_KEY, drafts)
  }
}

// Enhanced form data watcher for real-time storage
watch(
  formData,
  () => {
    saveDraft()
  },
  { deep: true }
)

// Watch current step changes
watch(
  currentStep,
  () => {
    saveDraft()
  }
)

// Form submission with fresh data from actual storage keys
const submitForm = async () => {
  try {
    isSubmitting.value = true
    submitError.value = null

    // Get fresh data from ALL storage keys being used by components
    const freshBasicData = eventBus.getState('edit_basic_data')
    const freshRepositoryData = eventBus.getState('edit_repository_data')
    const freshTechnicalData = eventBus.getState('edit_technical_data')
    const freshCapabilitiesData = eventBus.getState('edit_capabilities_data')
    const freshClaudeConfig = eventBus.getState<string>('edit_claude_config')
    const freshCapabilitiesEnvVars = eventBus.getState('capabilities_env_vars')


    // Start with current form data as base
    const finalFormData = { ...formData.value }

    // Update with fresh data from storage (this is what the user actually edited)
    if (freshBasicData) {
      finalFormData.basic = { ...finalFormData.basic, ...freshBasicData }
    }

    if (freshRepositoryData) {
      finalFormData.repository = { ...finalFormData.repository, ...freshRepositoryData }
    }

    if (freshTechnicalData) {
      finalFormData.technical = { ...finalFormData.technical, ...freshTechnicalData }
    }

    if (freshCapabilitiesData) {
      finalFormData.capabilities = { ...finalFormData.capabilities, ...freshCapabilitiesData }
    }

    // Update technical data from Claude Desktop config if available
    if (freshClaudeConfig && freshClaudeConfig.trim()) {
      try {
        const parsed = JSON.parse(freshClaudeConfig)
        if (parsed.mcpServers) {
          const serverKeys = Object.keys(parsed.mcpServers)
          if (serverKeys.length === 1) {
            const serverConfig = parsed.mcpServers[serverKeys[0]]

            finalFormData.technical = {
              ...finalFormData.technical,
              installation_methods: [{
                client: 'claude-desktop' as const,
                command: serverConfig.command,
                args: serverConfig.args,
                env: serverConfig.env || {}
              }]
            }
          }
        }
      } catch (error) {
        console.error('Failed to parse Claude config:', error)
      }
    }

    // Update capabilities data from environment variables if available
    if (freshCapabilitiesEnvVars && Array.isArray(freshCapabilitiesEnvVars)) {
      finalFormData.capabilities = {
        ...finalFormData.capabilities,
        environment_variables: freshCapabilitiesEnvVars
      }
    }


    // Emit the fresh form data to parent component
    emit('submit', finalFormData)

  } catch (error) {
    console.error('Form submission error:', error)
    submitError.value = error instanceof Error ? error.message : 'Failed to submit form'
  } finally {
    isSubmitting.value = false
  }
}

// Lifecycle
onMounted(() => {
  // Clean up expired drafts on mount
  cleanupExpiredDrafts()

  // In edit mode, check for existing draft and clear it before loading initial data
  if (props.mode === 'edit' && props.serverId) {
    clearDraft() // Clear any existing draft for this server
  }

  // Try to load draft (mainly for create mode or if user refreshed page)
  const draftLoaded = loadDraft()

  // If no draft was loaded and we have initial data, use it
  if (!draftLoaded && props.initialData) {
    // The initialData watcher will handle this
  }
})

onUnmounted(() => {
  // Save current state as draft when component unmounts (unless submitting)
  if (!isSubmitting.value) {
    saveDraft()
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Progress Bar Navigation -->
    <ProgressBars
      :steps="progressSteps"
      :progress="progressPercentage"
      :title="progressTitle"
      :variant="progressVariant"
      size="md"
      interactive
      styled
      @step-click="handleStepClick"
    />

    <!-- Error Message -->
    <Alert v-if="submitError" variant="destructive">
      <AlertDescription>
        {{ submitError }}
      </AlertDescription>
    </Alert>

    <!-- Step Content -->
    <ContentWrapper>
      <component
        :is="currentStepData.component"
        v-if="currentStepData.key === 'capabilities'"
        :form-data="formData"
        @update:form-data="(newFormData: McpServerFormData) => formData = newFormData"
      />
      <component
        :is="currentStepData.component"
        v-else-if="currentStepData.key === 'basic'"
        v-model="formData[currentStepData.key]"
        :form-data="formData"
        :mode="props.mode"
        @update:modelValue="(newValue: any) => formData[currentStepData.key] = newValue"
        @update:formData="(newFormData: any) => formData = newFormData"
      />
      <component
        :is="currentStepData.component"
        v-else-if="currentStepData.key === 'technical'"
        :form-data="formData"
        :mode="props.mode"
        @update:formData="(newFormData: any) => formData = newFormData"
      />
      <component
        :is="currentStepData.component"
        v-else
        v-model="formData[currentStepData.key]"
        :form-data="formData"
        @update:modelValue="(newValue: any) => formData[currentStepData.key] = newValue"
        @update:formData="(newFormData: any) => formData = newFormData"
      />
    </ContentWrapper>

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
          :loading="isFetchingGitHub"
          :loading-text="t('mcpCatalog.form.navigation.fetching')"
          class="min-w-[120px]"
        >
          {{ t('mcpCatalog.form.navigation.next') }}
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
          :loading="isSubmitting"
          :loading-text="props.mode === 'edit' ? t('mcpCatalog.form.navigation.updating') : t('mcpCatalog.form.navigation.creating')"
        >
          {{ props.mode === 'edit' ? t('mcpCatalog.form.navigation.update') : t('mcpCatalog.form.navigation.submit') }}
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
