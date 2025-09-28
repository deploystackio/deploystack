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
import { FileText, Github, Code, Settings, CheckCircle } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import ContentWrapper from '@/components/ContentWrapper.vue'
import BasicInfoStepEdit from '@/components/admin/mcp-catalog/steps/BasicInfoStepEdit.vue'
import TechnicalStep from '@/components/admin/mcp-catalog/TechnicalStep.vue'
import ConfigurationSchemaStepEdit from '@/components/admin/mcp-catalog/steps/ConfigurationSchemaStepEdit.vue'
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
    component: BasicInfoStepEdit
  },
  {
    key: 'technical' as const,
    label: t('mcpCatalog.form.steps.technical'),
    icon: Code,
    component: TechnicalStep
  },
  {
    key: 'configurationSchema' as const,
    label: t('mcpCatalog.form.steps.configurationSchema'),
    icon: Settings,
    component: ConfigurationSchemaStepEdit
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
  if (!currentStepData) {
    return t('mcpCatalog.form.steps.configuring')
  }
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

// Initialize storage with form data for edit mode - FORCE FRESH DATA LOADING
const initializeStorageWithData = (data: McpServerFormData) => {
  // Always overwrite storage with fresh data in edit mode
  // This ensures we load fresh data from database, not old corrupted cache
  eventBus.setState('edit_basic_data', data.basic)
  eventBus.setState('edit_repository_data', data.repository)

  // Parse installation_methods if it's a string (from database)
  const technicalData = { ...data.technical }
  if (typeof technicalData.installation_methods === 'string') {
    try {
      technicalData.installation_methods = JSON.parse(technicalData.installation_methods)
    } catch (e) {
      console.error('Failed to parse installation_methods in initializeStorageWithData:', e)
      technicalData.installation_methods = []
    }
  }

  eventBus.setState('edit_technical_data', technicalData)

  // FORCE FRESH CONFIGURATION SCHEMA - always overwrite in edit mode
  if (data.configuration_schema) {
    // Ensure all header fields are included
    const fullConfigSchema = {
      template_args: data.configuration_schema.template_args || [],
      template_env: data.configuration_schema.template_env || [],
      template_headers: data.configuration_schema.template_headers || [],
      team_args_schema: data.configuration_schema.team_args_schema || [],
      team_env_schema: data.configuration_schema.team_env_schema || [],
      team_headers_schema: data.configuration_schema.team_headers_schema || [],
      user_args_schema: data.configuration_schema.user_args_schema || [],
      user_env_schema: data.configuration_schema.user_env_schema || [],
      user_headers_schema: data.configuration_schema.user_headers_schema || [],
    }

    eventBus.setState('edit_configuration_schema', fullConfigSchema)
  }

  // Initialize Claude Desktop config if available
  if (technicalData.installation_methods && technicalData.installation_methods.length > 0) {
  const method = technicalData.installation_methods[0]
  if (method && method.client === 'claude-desktop') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let serverConfig: any

      if (method.url) {
        // HTTP server configuration
        serverConfig = {
          url: method.url,
          type: method.type || 'streamableHttp',
          headers: method.headers || {}
        }
      } else {
        // Stdio server configuration
        serverConfig = {
          command: method.command || '',
          args: method.args || [],
          env: method.env || {},
          headers: method.headers || {}
        }
      }

      const claudeConfig = {
        mcpServers: {
          [data.basic.name || 'server']: serverConfig
        }
      }
      eventBus.setState('edit_claude_config', JSON.stringify(claudeConfig, null, 2))
    }
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
    installation_methods: [],
    dependencies: '',
    transport_type: 'auto'
  },
  configuration_schema: {},
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
      formData.value = {
        ...formData.value,
        basic: { ...formData.value.basic, ...newInitialData.basic },
        repository: { ...formData.value.repository, ...newInitialData.repository },
        technical: { ...formData.value.technical, ...newInitialData.technical },
        configuration_schema: newInitialData.configuration_schema ? newInitialData.configuration_schema : formData.value.configuration_schema,
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
const currentStepData = computed(() => steps[currentStep.value] || null)
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
    const stepData = steps[stepIndex]
    if (!stepData) return
    emit('stepChanged', { step: stepIndex, stepKey: stepData.key })

    // Emit event bus event for other components
    eventBus.emit('mcp-form-step-changed', {
      from: oldStep,
      to: stepIndex,
      stepKey: stepData.key
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
    const stepData = steps[currentStep.value]
    if (!stepData) return
    emit('stepChanged', { step: currentStep.value, stepKey: stepData.key })

    // Emit event bus event
    eventBus.emit('mcp-form-step-changed', {
      from: oldStep,
      to: currentStep.value,
      stepKey: stepData.key
    })
  }
}

const previousStep = () => {
  if (canGoPrevious.value) {
    const oldStep = currentStep.value
    currentStep.value--
    const stepData = steps[currentStep.value]
    if (!stepData) return
    emit('stepChanged', { step: currentStep.value, stepKey: stepData.key })

    // Emit event bus event
    eventBus.emit('mcp-form-step-changed', {
      from: oldStep,
      to: currentStep.value,
      stepKey: stepData.key
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
      installation_methods: githubData.installation_methods || [],
      dependencies: githubData.dependencies || '',
      transport_type: githubData.transport_type || 'auto'
    },
    configuration_schema: githubData.configuration_schema || {},
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
    const freshConfigurationSchema = eventBus.getState('edit_configuration_schema')

    const freshClaudeConfig = eventBus.getState<string>('edit_claude_config')



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

    if (freshConfigurationSchema) {
      finalFormData.configuration_schema = freshConfigurationSchema
    }



    // Update technical data from Claude Desktop config if available
    if (freshClaudeConfig && freshClaudeConfig.trim()) {
      try {
        const parsed = JSON.parse(freshClaudeConfig)
        if (parsed.mcpServers) {
          const serverKeys = Object.keys(parsed.mcpServers)
          if (serverKeys.length === 1) {
            const serverKey = serverKeys[0]
            if (!serverKey) return
            const serverConfig = parsed.mcpServers[serverKey]

            finalFormData.technical = {
              ...finalFormData.technical,
              installation_methods: [{
                client: 'claude-desktop' as const,
                command: serverConfig.command,
                args: serverConfig.args,
                env: serverConfig.env || {},
                url: serverConfig.url,
                type: serverConfig.type,
                headers: serverConfig.headers || {}
              }]
            }
          }
        }
      } catch (error) {
        console.error('Failed to parse Claude config:', error)
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
        :is="currentStepData?.component"
        v-if="currentStepData?.key === 'basic'"
        v-model="formData[currentStepData.key]"
        :form-data="formData"
        :mode="props.mode"
        @update:modelValue="(newValue: any) => { if (currentStepData?.key && currentStepData.key !== 'configurationSchema') { (formData as any)[currentStepData.key] = newValue } }"
        @update:formData="(newFormData: any) => formData = newFormData"
      />
      <component
        :is="currentStepData?.component"
        v-else-if="currentStepData?.key === 'technical'"
        :form-data="formData"
        :mode="props.mode"
        @update:formData="(newFormData: any) => formData = newFormData"
      />
      <ConfigurationSchemaStepEdit
        v-else-if="currentStepData?.key === 'configurationSchema'"
      />
      <component
        :is="currentStepData?.component"
        v-else-if="currentStepData"
        v-model="formData[currentStepData.key]"
        :form-data="formData"
        @update:modelValue="(newValue: any) => { if (currentStepData?.key && currentStepData.key !== 'configurationSchema') { (formData as any)[currentStepData.key] = newValue } }"
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
