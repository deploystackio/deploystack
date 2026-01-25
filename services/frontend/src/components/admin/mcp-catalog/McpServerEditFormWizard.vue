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
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DsStepper, type WizardStep } from '@/components/ui/ds-stepper'
import { DsCard } from '@/components/ui/ds-card'
import { FileText, GitBranch, Code, Settings, CheckCircle, BookOpen } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import BasicInfoStepEdit from '@/components/admin/mcp-catalog/steps/BasicInfoStepEdit.vue'
import TechnicalStep from '@/components/admin/mcp-catalog/TechnicalStep.vue'
import ConfigurationSchemaStepEdit from '@/components/admin/mcp-catalog/steps/ConfigurationSchemaStepEdit.vue'
import RepositoryStep from '@/components/admin/mcp-catalog/RepositoryStep.vue'
import ReadmeStep from '@/components/admin/mcp-catalog/ReadmeStep.vue'
import ReviewStep from '@/components/admin/mcp-catalog/ReviewStep.vue'
import type {
  McpServerFormData,
  ConfigurationSchemaFormData
} from '@/views/admin/mcp-server-catalog/types'

// Props interface
interface Props {
  mode?: 'create' | 'edit'
  initialData?: Partial<McpServerFormData>
  submitButtonText?: string
  cancelButtonText?: string
  serverId?: string
  isSubmitting?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  submitButtonText: '',
  cancelButtonText: '',
  serverId: '',
  isSubmitting: false
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
    key: 'repository' as const,
    label: t('mcpCatalog.form.steps.repository'),
    icon: GitBranch,
    component: RepositoryStep
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
    key: 'readme' as const,
    label: 'README',
    icon: BookOpen,
    component: ReadmeStep
  },
  {
    key: 'review' as const,
    label: t('mcpCatalog.form.steps.review'),
    icon: CheckCircle,
    component: ReviewStep
  }
]

// Wizard steps for DsStepper component
const wizardSteps = computed((): WizardStep[] => {
  return steps.map((step, index) => {
    let status: 'completed' | 'current' | 'pending' = 'pending'

    if (index < currentStep.value) {
      status = 'completed'
    } else if (index === currentStep.value) {
      status = 'current'
    }

    return {
      id: step.key,
      label: step.label,
      status
    }
  })
})

// State
const currentStep = ref(0)
const internalIsSubmitting = ref(false)
const submitError = ref<string | null>(null)
const isFetchingRepository = ref(false)
const repositoryFetchError = ref<string | null>(null)

// Initialize storage with form data for edit mode - FORCE FRESH DATA LOADING
const initializeStorageWithData = (data: McpServerFormData) => {
  // Always overwrite storage with fresh data in edit mode
  // This ensures we load fresh data from database, not old corrupted cache
  eventBus.setState('edit_basic_data', data.basic)

  // Ensure we have default values for repository fields
  const repositoryData = {
    repository_url: data.repository.repository_url || '',
    repository_source: data.repository.repository_source || 'github',
    repository_id: data.repository.repository_id || '',
    repository_subfolder: data.repository.repository_subfolder || '',
    git_branch: data.repository.git_branch || '',
    website_url: data.repository.website_url || ''
  }

  eventBus.setState('edit_repository_data', repositoryData)

  // Initialize repository_setup for the first step using the same data
  const repositorySetupData = {
    repository_url: repositoryData.repository_url || '',
    repository_source: repositoryData.repository_source || '',
    git_branch: repositoryData.git_branch || '',
    auto_populated: !!data.repository_setup?.auto_populated
  }
  eventBus.setState('edit_repository_setup_data', repositorySetupData)

  // Parse packages/remotes if they're strings (from database)
  const technicalData = { ...data.technical }
  if (typeof technicalData.packages === 'string') {
    try {
      technicalData.packages = JSON.parse(technicalData.packages)
    } catch (e) {
      console.error('Failed to parse packages in initializeStorageWithData:', e)
      technicalData.packages = null
    }
  }
  if (typeof technicalData.remotes === 'string') {
    try {
      technicalData.remotes = JSON.parse(technicalData.remotes)
    } catch (e) {
      console.error('Failed to parse remotes in initializeStorageWithData:', e)
      technicalData.remotes = null
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
      template_url_query_params: data.configuration_schema.template_url_query_params || [],
      team_args_schema: data.configuration_schema.team_args_schema || [],
      team_env_schema: data.configuration_schema.team_env_schema || [],
      team_headers_schema: data.configuration_schema.team_headers_schema || [],
      team_url_query_params_schema: data.configuration_schema.team_url_query_params_schema || [],
      user_args_schema: data.configuration_schema.user_args_schema || [],
      user_env_schema: data.configuration_schema.user_env_schema || [],
      user_headers_schema: data.configuration_schema.user_headers_schema || [],
      user_url_query_params_schema: data.configuration_schema.user_url_query_params_schema || [],
    }

    eventBus.setState('edit_configuration_schema', fullConfigSchema)
  }

  // Initialize Claude Desktop config
  // PRIORITY: Use schema fields (source of truth after editing) over packages (legacy/original data)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let serverConfig: any = null

  // Check if we have schema data (this is the source of truth after user edits)
  const configSchema = data.configuration_schema
  const hasSchemaArgs = configSchema && (
    (configSchema.template_args && configSchema.template_args.length > 0) ||
    (configSchema.team_args_schema && configSchema.team_args_schema.length > 0) ||
    (configSchema.user_args_schema && configSchema.user_args_schema.length > 0)
  )

  // First, try to find a valid remote (HTTP/SSE server)
  // Note: remotes may contain [null] from DB, so we must find a truly valid entry
  const validRemote = technicalData.remotes && Array.isArray(technicalData.remotes)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? technicalData.remotes.find((r: any) => r && typeof r === 'object' && r.url)
    : null

  // Then, try to find a valid package (STDIO server) - needed for command
  const validPackage = technicalData.packages && Array.isArray(technicalData.packages)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? technicalData.packages.find((p: any) => p && typeof p === 'object' && p.transport)
    : null

  if (validRemote) {
    // HTTP/SSE server from remotes
    serverConfig = {
      url: validRemote.url,
      type: validRemote.type || 'sse',
      headers: validRemote.headers || {}
    }
  } else if (hasSchemaArgs) {
    // STDIO server - build args from schema fields (source of truth)
     
    const allArgs: { value: string; order: number }[] = []

    // Template args (static values)
    if (configSchema.template_args && Array.isArray(configSchema.template_args)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configSchema.template_args.forEach((arg: any, index: number) => {
        allArgs.push({ value: arg.value, order: arg.order ?? index })
      })
    }

    // Team args
    if (configSchema.team_args_schema && Array.isArray(configSchema.team_args_schema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configSchema.team_args_schema.forEach((arg: any, index: number) => {
        allArgs.push({ value: arg.name, order: arg.order ?? (100 + index) })
      })
    }

    // User args
    if (configSchema.user_args_schema && Array.isArray(configSchema.user_args_schema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configSchema.user_args_schema.forEach((arg: any, index: number) => {
        allArgs.push({ value: arg.name, order: arg.order ?? (200 + index) })
      })
    }

    // Sort by order and extract values
    allArgs.sort((a, b) => a.order - b.order)
    const argsArray = allArgs.map(arg => arg.value)

    // Build env from schema
     
    const envObj: Record<string, string> = {}
    if (configSchema.team_env_schema && Array.isArray(configSchema.team_env_schema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configSchema.team_env_schema.forEach((env: any) => {
        envObj[env.name] = `<${env.name}>`
      })
    }
    if (configSchema.user_env_schema && Array.isArray(configSchema.user_env_schema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configSchema.user_env_schema.forEach((env: any) => {
        envObj[env.name] = `<${env.name}>`
      })
    }

    serverConfig = {
      command: validPackage?.transport?.command || 'npx',
      args: argsArray,
      env: envObj
    }
  } else if (validPackage) {
    // Fallback: STDIO server from packages (legacy data without schema)
    serverConfig = {
      command: validPackage.transport.command || 'npx',
      args: validPackage.transport.args || [],
      env: validPackage.env || {}
    }
  }

  if (serverConfig) {
    const claudeConfig = {
      mcpServers: {
        [data.basic.name || 'server']: serverConfig
      }
    }
    eventBus.setState('edit_claude_config', JSON.stringify(claudeConfig, null, 2))
  }

  // Initialize README data - decode base64 to markdown for editing
  if (data.readme && data.readme.github_readme_base64) {
    try {
      const readmeMarkdown = atob(data.readme.github_readme_base64)
      eventBus.setState('edit_readme_data', { readme_markdown: readmeMarkdown })
    } catch (e) {
      console.error('Failed to decode README base64:', e)
      eventBus.setState('edit_readme_data', { readme_markdown: '' })
    }
  } else {
    eventBus.setState('edit_readme_data', { readme_markdown: '' })
  }
}

// Form data with proper initialization
const formData = ref<McpServerFormData>({
  basic: {
    name: '',
    slug: '',
    description: '',
    long_description: '',
    category_id: '',
    author_name: '',
    author_contact: '',
    organization: '',
    license: '',
    tags: [],
    featured: false,
    auto_install_new_default_team: false,
    website_url: '',
    icon_url: '',
    language: 'typescript',
    runtime: 'node'
  },
  repository: {
    repository_url: '',
    repository_source: '',
    repository_id: '',
    repository_subfolder: '',
    git_branch: '',
    website_url: ''
  },
  technical: {
    language: '',
    runtime: '',
    installation_methods: [],
    dependencies: '',
    transport_type: 'auto'
  },
  configuration_schema: {},
  repository_setup: {
    repository_url: '',
    repository_source: '',
    git_branch: '',
    auto_populated: false
  },
  readme: {
    github_readme_base64: ''
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
        repository_setup: { ...formData.value.repository_setup, ...newInitialData.repository_setup },
        readme: { ...formData.value.readme, ...newInitialData.readme },
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
const isFirstStep = computed(() => currentStep.value === 0)
const isLastStep = computed(() => currentStep.value === steps.length - 1)
const canGoNext = computed(() => !isLastStep.value)
const canGoPrevious = computed(() => !isFirstStep.value)

const canProceedFromRepository = computed(() => {
  // Repository URL is optional - always allow proceeding unless fetching
  return !isFetchingRepository.value
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

// Handle step click from DsStepper
const handleStepClick = (step: WizardStep, index: number) => {
  if (step.status === 'completed') {
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

// Repository step navigation with auto-population
const handleRepositoryStepNext = async () => {
  if (currentStep.value !== 0) return

  const repositoryUrl = formData.value.repository_setup.repository_url

  // If no repository URL provided, skip fetching and go to next step
  if (!repositoryUrl || repositoryUrl.trim() === '') {
    nextStep()
    return
  }

  // In edit mode, skip repository auto-population and just go to next step
  if (props.mode === 'edit') {
    nextStep()
    return
  }

  try {
    isFetchingRepository.value = true
    repositoryFetchError.value = null

    const gitBranch = formData.value.repository_setup.git_branch

    // Call backend API to fetch repository data from any supported platform
    const response = await McpCatalogService.getRepositoryInfo(repositoryUrl, gitBranch)

    if (response.success && response.data) {
      // Auto-populate all form data
      autoPopulateFromRepository(response.data)

      // Emit events
      emit('githubDataPopulated', response.data) // Keep same event name for backward compatibility
      // Event emission removed - repository data is handled through form state

      // Advance to next step
      nextStep()
    } else {
      throw new Error(response.message || 'Failed to fetch repository information')
    }
  } catch (error) {
    repositoryFetchError.value = error instanceof Error ? error.message : 'Failed to fetch repository data'
    // Stay on current step - user must retry
  } finally {
    isFetchingRepository.value = false
  }
}

// Enhanced auto-population function for any repository platform
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const autoPopulateFromRepository = (repositoryData: any) => {
  formData.value = {
    ...formData.value,
    basic: {
      name: repositoryData.name || '',
      description: repositoryData.description || '',
      long_description: repositoryData.readme_content || repositoryData.description || '',
      category_id: '',
      author_name: repositoryData.owner?.login || repositoryData.author_name || '',
      author_contact: repositoryData.owner?.email || repositoryData.author_contact || '',
      organization: repositoryData.owner?.type === 'Organization' ? repositoryData.owner.login : (repositoryData.organization || ''),
      license: repositoryData.license?.spdx_id || repositoryData.license || '',
      tags: repositoryData.topics || repositoryData.tags || [],
      featured: false,
      auto_install_new_default_team: false,
      website_url: repositoryData.homepage || repositoryData.website_url || '',
      language: formData.value.basic.language || 'typescript',
      runtime: formData.value.basic.runtime || 'node'
    },
    repository: {
      repository_url: repositoryData.html_url || repositoryData.repository_url || formData.value.repository_setup.repository_url,
      repository_source: repositoryData.repository_source || formData.value.repository_setup.repository_source,
      repository_id: repositoryData.repository_id || '',
      repository_subfolder: repositoryData.repository_subfolder || '',
      git_branch: repositoryData.default_branch || '',
      website_url: repositoryData.homepage || repositoryData.website_url || ''
    },
    technical: {
      language: repositoryData.language || '',
      runtime: 'node',
      installation_methods: repositoryData.installation_methods || [],
      dependencies: repositoryData.dependencies || '',
      transport_type: repositoryData.transport_type || 'auto'
    },
    configuration_schema: repositoryData.configuration_schema || {},
    repository_setup: {
      repository_url: repositoryData.html_url || repositoryData.repository_url || formData.value.repository_setup.repository_url,
      repository_source: repositoryData.repository_source || formData.value.repository_setup.repository_source,
      git_branch: repositoryData.default_branch || '',
      auto_populated: true,
      repo_data: repositoryData
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

// Reset internal submitting state when parent signals completion
watch(
  () => props.isSubmitting,
  (newValue) => {
    if (!newValue) {
      internalIsSubmitting.value = false
    }
  }
)

// Form submission with fresh data from actual storage keys
const submitForm = async () => {
  try {
    internalIsSubmitting.value = true
    submitError.value = null

    // Get fresh data from ALL storage keys being used by components
    const freshBasicData = eventBus.getState('edit_basic_data')
    const freshRepositoryData = eventBus.getState('edit_repository_data')
    const freshRepositorySetupData = eventBus.getState('edit_repository_setup_data')
    const freshTechnicalData = eventBus.getState('edit_technical_data')
    const freshConfigurationSchema = eventBus.getState<ConfigurationSchemaFormData>('edit_configuration_schema')

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

    // Also merge repository setup data if available (for consistency)
    if (freshRepositorySetupData && typeof freshRepositorySetupData === 'object') {
      const repoSetup = freshRepositorySetupData as { repository_url?: string; repository_source?: string; git_branch?: string }
      finalFormData.repository_setup = { ...finalFormData.repository_setup, ...freshRepositorySetupData }

      // Sync repository data with repository setup data to ensure consistency
      finalFormData.repository = {
        ...finalFormData.repository,
        repository_url: repoSetup.repository_url || finalFormData.repository.repository_url,
        repository_source: repoSetup.repository_source || finalFormData.repository.repository_source,
        git_branch: repoSetup.git_branch || finalFormData.repository.git_branch
      }
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
    internalIsSubmitting.value = false
  }
  // Note: Don't reset internalIsSubmitting in finally - parent controls final state via prop
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
  if (!props.isSubmitting && !internalIsSubmitting.value) {
    saveDraft()
  }
})
</script>

<template>
  <div class="flex gap-8">
    <!-- Wizard Stepper (Left Sidebar) -->
    <DsStepper
      :steps="wizardSteps"
      interactive
      @step-click="handleStepClick"
    />

    <!-- Step Content (Right Side) -->
    <div class="flex-1 space-y-6">
      <!-- Error Message -->
      <Alert v-if="submitError" variant="destructive">
        <AlertDescription>
          {{ submitError }}
        </AlertDescription>
      </Alert>

      <!-- Step 1: Repository -->
      <DsCard v-if="currentStep === 0" :title="t('mcpCatalog.form.steps.repository')">
        <RepositoryStep
          v-model="formData.repository_setup"
          :form-data="formData"
          @update:modelValue="(newValue: any) => formData.repository_setup = newValue"
          @update:formData="(newFormData: any) => formData = newFormData"
        />

        <!-- Repository Fetch Error -->
        <Alert v-if="repositoryFetchError" variant="destructive" class="mt-4">
          <AlertDescription>
            {{ repositoryFetchError }}
            <br>
            <span class="text-sm">{{ t('mcpCatalog.validation.repositoryUrlInvalid') }}</span>
          </AlertDescription>
        </Alert>

        <template #footer-actions>
          <Button variant="outline" @click="handleCancel">
            {{ cancelText }}
          </Button>
          <Button
            @click="handleRepositoryStepNext"
            :disabled="!canProceedFromRepository || isFetchingRepository"
            class="min-w-[120px]"
          >
            <Spinner v-if="isFetchingRepository" class="mr-2" />
            {{ t('mcpCatalog.form.navigation.next') }}
          </Button>
        </template>
      </DsCard>

      <!-- Step 2: Basic Info -->
      <DsCard v-else-if="currentStep === 1" :title="t('mcpCatalog.form.steps.basic')">
        <BasicInfoStepEdit
          v-model="formData.basic"
          :form-data="formData"
          :mode="props.mode"
          @update:modelValue="(newValue: any) => formData.basic = newValue"
          @update:formData="(newFormData: any) => formData = newFormData"
        />

        <template #footer-actions>
          <Button variant="outline" @click="previousStep">
            {{ t('mcpCatalog.form.navigation.previous') }}
          </Button>
          <Button @click="nextStep">
            {{ t('mcpCatalog.form.navigation.next') }}
          </Button>
        </template>
      </DsCard>

      <!-- Step 3: Technical -->
      <DsCard v-else-if="currentStep === 2" :title="t('mcpCatalog.form.steps.technical')">
        <TechnicalStep
          :form-data="formData"
          :mode="props.mode"
          @update:formData="(newFormData: any) => formData = newFormData"
        />

        <template #footer-actions>
          <Button variant="outline" @click="previousStep">
            {{ t('mcpCatalog.form.navigation.previous') }}
          </Button>
          <Button @click="nextStep">
            {{ t('mcpCatalog.form.navigation.next') }}
          </Button>
        </template>
      </DsCard>

      <!-- Step 4: Configuration Schema -->
      <div v-else-if="currentStep === 3" class="space-y-6">
        <h2 class="text-lg font-semibold">{{ t('mcpCatalog.form.steps.configurationSchema') }}</h2>

        <ConfigurationSchemaStepEdit />

        <!-- Navigation Buttons -->
        <div class="flex justify-end gap-3 pt-4">
          <Button variant="outline" @click="previousStep">
            {{ t('mcpCatalog.form.navigation.previous') }}
          </Button>
          <Button @click="nextStep">
            {{ t('mcpCatalog.form.navigation.next') }}
          </Button>
        </div>
      </div>

      <!-- Step 5: README -->
      <DsCard v-else-if="currentStep === 4" title="README">
        <ReadmeStep
          v-model="formData.readme"
          :form-data="formData"
          @update:modelValue="(newValue: any) => formData.readme = newValue"
          @update:formData="(newFormData: any) => formData = newFormData"
        />

        <template #footer-actions>
          <Button variant="outline" @click="previousStep">
            {{ t('mcpCatalog.form.navigation.previous') }}
          </Button>
          <Button @click="nextStep">
            {{ t('mcpCatalog.form.navigation.next') }}
          </Button>
        </template>
      </DsCard>

      <!-- Step 6: Review -->
      <DsCard v-else-if="currentStep === 5" :title="t('mcpCatalog.form.steps.review')">
        <ReviewStep
          v-model="formData.review"
          :form-data="formData"
          @update:modelValue="(newValue: any) => formData.review = newValue"
          @update:formData="(newFormData: any) => formData = newFormData"
        />

        <template #footer-actions>
          <Button variant="outline" @click="previousStep">
            {{ t('mcpCatalog.form.navigation.previous') }}
          </Button>
          <Button
            @click="submitForm"
            :disabled="props.isSubmitting || internalIsSubmitting"
          >
            <Spinner v-if="props.isSubmitting || internalIsSubmitting" class="mr-2" />
            {{ props.mode === 'edit' ? t('mcpCatalog.form.navigation.update') : t('mcpCatalog.form.navigation.submit') }}
          </Button>
        </template>
      </DsCard>
    </div>
  </div>
</template>
