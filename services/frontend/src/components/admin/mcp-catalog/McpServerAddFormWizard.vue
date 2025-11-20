<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ProgressBars } from '@/components/ui/progress-bars'
import { FileText, Github, Settings } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import ContentWrapper from '@/components/ContentWrapper.vue'
import GitHubRepositoryStep from '@/components/admin/mcp-catalog/GitHubRepositoryStep.vue'
import ClaudeDesktopConfigStep from '@/components/admin/mcp-catalog/ClaudeDesktopConfigStep.vue'
import ConfigurationSchemaStepAdd from '@/components/admin/mcp-catalog/steps/ConfigurationSchemaStepAdd.vue'
import BasicInfoStepAdd from '@/components/admin/mcp-catalog/steps/BasicInfoStepAdd.vue'
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

  submit: [formData: any] // Use any to avoid circular type dependencies, parent view defines the final type
  cancel: []
  stepChanged: [data: { step: number; stepKey: string }]
  githubDataPopulated: [githubData: Record<string, unknown>]
}>()

const { t } = useI18n()
const eventBus = useEventBus()

// Form data interface for add wizard
interface McpServerAddFormData {
  repository: {
    repository_url: string
    repository_source: string
    git_branch: string
    auto_populated: boolean
    repo_data?: any
  }
  claudeConfig: {
    claude_desktop_config: object
    raw_json: string
  }
  configuration_schema: object,
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
    featured: boolean
    auto_install_new_default_team: boolean
    transport_type: string
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
    key: 'configurationSchema' as const,
    label: t('mcpCatalog.form.steps.configurationSchema'),
    icon: Settings, // You might want to change this icon
    component: ConfigurationSchemaStepAdd
  },
  {
    key: 'basic' as const,
    label: t('mcpCatalog.form.steps.basic'),
    icon: FileText,
    component: BasicInfoStepAdd
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
// Step 1 (index 0): 0%
// Step 2 (index 1): 33%
// Step 3 (index 2): 66%
// Step 4 (index 3): 100%
return (currentStep.value / (steps.length - 1)) * 100
})

// Progress title based on current step
const progressTitle = computed(() => {
  if (isSubmitting.value) {
    return t('mcpCatalog.form.navigation.creating')
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

// Form data with proper initialization
const formData = ref<McpServerAddFormData>({
  repository: {
    repository_url: '',
    repository_source: 'github',
    git_branch: 'main',
    auto_populated: false
  },
  claudeConfig: {
    claude_desktop_config: {},
    raw_json: ''
  },
  configuration_schema: {},
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
    auto_install_new_default_team: false,
    transport_type: 'auto'
  }
})

// Create compatible form data for existing components
const compatibleFormData = computed((): McpServerFormData => ({
  basic: formData.value.basic,
  repository: {
    repository_url: formData.value.repository.repository_url,
    repository_source: formData.value.repository.repository_source,
    git_branch: formData.value.repository.git_branch,
    website_url: ''
  },
  technical: {
    language: '',
    runtime: 'node',
    installation_methods: [],
    dependencies: '',
    transport_type: 'auto'
  },
  configuration_schema: formData.value.configuration_schema,
  repository_setup: formData.value.repository,
  review: {}
}))

// Computed properties
const isFirstStep = computed(() => currentStep.value === 0)
const isLastStep = computed(() => currentStep.value === steps.length - 1)
const canGoNext = computed(() => !isLastStep.value)
const canGoPrevious = computed(() => !isFirstStep.value)

const canProceedFromGitHub = computed(() => {
  // Always allow proceeding from GitHub step (URL is optional)
  return !isFetchingGitHub.value
})

const canProceedFromClaudeConfig = computed(() => {
  return formData.value.claudeConfig.claude_desktop_config &&
         Object.keys(formData.value.claudeConfig.claude_desktop_config).length > 0
})

const canSubmit = computed(() => {
  return formData.value.basic.name &&
         formData.value.basic.description &&
         canProceedFromClaudeConfig.value
})

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

// Repository step navigation with auto-population
const handleGitHubStepNext = async () => {
  if (currentStep.value !== 0) return

  const repositoryUrl = formData.value.repository.repository_url

  // If no GitHub URL provided, skip fetching and go to next step
  if (!repositoryUrl || repositoryUrl.trim() === '') {
    nextStep()
    return
  }

  // GitHub URL provided - fetch and validate
  try {
    isFetchingGitHub.value = true
    githubFetchError.value = null

    const gitBranch = formData.value.repository.git_branch

    // Call backend API to fetch repository data
    const response = await McpCatalogService.getRepositoryInfo(repositoryUrl, gitBranch)

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

// Auto-population function for repository data
const autoPopulateFromGitHub = (repositoryData: any) => {
  // Update repository data
  formData.value.repository = {
    ...formData.value.repository,
    auto_populated: true,
    repo_data: repositoryData
  }

  // Auto-populate basic info
  formData.value.basic = {
    ...formData.value.basic,
    name: repositoryData.name || '',
    description: repositoryData.description || '',
    long_description: repositoryData.readme_content || repositoryData.description || '',
    author_name: repositoryData.owner?.login || repositoryData.author_name || '',
    author_contact: repositoryData.owner?.email || repositoryData.author_contact || '',
    organization: repositoryData.owner?.type === 'Organization' ? repositoryData.owner.login : (repositoryData.organization || ''),
    license: repositoryData.license?.spdx_id || repositoryData.license || '',
    tags: repositoryData.topics || repositoryData.tags || [],
    // Keep existing values for these properties
    featured: formData.value.basic.featured,
    auto_install_new_default_team: formData.value.basic.auto_install_new_default_team,
    transport_type: formData.value.basic.transport_type
  }
}

// Form submission
const submitForm = async () => {
  try {
    isSubmitting.value = true
    submitError.value = null

    // Extract data from Claude Desktop config for packages/remotes
    const claudeConfig = formData.value.claudeConfig.claude_desktop_config as any;
    let extractedPackages: any = null;
    let extractedRemotes: any = null;
    let extractedTransportType = 'stdio';

    if (claudeConfig && claudeConfig.mcpServers) {
      const serverKey = Object.keys(claudeConfig.mcpServers)[0];
      const serverConfig = serverKey ? claudeConfig.mcpServers[serverKey] : null;

      if (serverConfig) {
        if (serverConfig.url) {
          // HTTP/SSE server - use remotes
          // Map 'http' to 'streamable-http' for MCP spec compliance
          const remoteType = serverConfig.type === 'http' ? 'streamable-http' : (serverConfig.type || 'sse');
          extractedRemotes = [{
            type: remoteType,
            url: serverConfig.url,
            headers: serverConfig.headers || {}
          }];
          extractedTransportType = serverConfig.type || 'http';
        } else if (serverConfig.command) {
          // STDIO server - use packages
          extractedPackages = [{
            transport: {
              type: 'stdio',
              command: serverConfig.command,
              args: serverConfig.args || []
            },
            env: serverConfig.env || {}
          }];
          extractedTransportType = 'stdio';
        }
      }
    }

    // Construct the final payload for the backend API
    const finalPayload: any = {
      // Basic Info
      name: formData.value.basic.name,
      description: formData.value.basic.description,
      long_description: formData.value.basic.long_description,
      category_id: formData.value.basic.category_id,
      author_name: formData.value.basic.author_name,
      author_contact: formData.value.basic.author_contact,
      organization: formData.value.basic.organization,
      license: formData.value.basic.license,
      tags: formData.value.basic.tags,
      featured: formData.value.basic.featured,
      auto_install_new_default_team: formData.value.basic.auto_install_new_default_team,

      // New Configuration Schema (ADR-007)
      configuration_schema: formData.value.configuration_schema,

      // Also send Claude Desktop config for backend fallback
      claude_desktop_config: formData.value.claudeConfig.claude_desktop_config,

      // Properly extracted fields based on transport type
      language: extractedTransportType === 'http' || extractedTransportType === 'sse' ? 'http' : 'typescript',
      runtime: extractedTransportType === 'http' || extractedTransportType === 'sse' ? 'http' : 'node',
      transport_type: extractedTransportType,
      packages: extractedPackages,
      remotes: extractedRemotes,
    };

    // Only include repository fields if repository URL is provided
    const repositoryUrl = formData.value.repository.repository_url;
    if (repositoryUrl && repositoryUrl.trim() !== '') {
      finalPayload.repository_url = repositoryUrl;
      finalPayload.repository_source = formData.value.repository.repository_source;
      finalPayload.git_branch = formData.value.repository.git_branch;

      // From auto-population or manual entry
      if (formData.value.repository.repo_data?.homepage) {
        finalPayload.website_url = formData.value.repository.repo_data.homepage;
      }
    }

    await emit('submit', finalPayload)

  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Failed to submit form'
    isSubmitting.value = false
  }
  // Note: isSubmitting will be reset by parent after successful redirect
}

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
      <!-- Repository Step -->
      <GitHubRepositoryStep
        v-if="currentStep === 0"
        v-model="formData.repository"
        :form-data="compatibleFormData"
      />

      <!-- Claude Config Step -->
      <ClaudeDesktopConfigStep
        v-else-if="currentStep === 1"
        v-model="formData.claudeConfig"
      />

      <!-- Configuration Schema Step -->
      <ConfigurationSchemaStepAdd
        v-else-if="currentStep === 2"
        v-model="formData.configuration_schema"
        :claudeConfig="formData.claudeConfig"
      />

      <!-- Basic Info Step -->
      <BasicInfoStepAdd
        v-else-if="currentStep === 3"
        v-model="formData.basic"
        :form-data="compatibleFormData"
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

        <!-- Normal next button for Claude config and new Schema step -->
        <Button
          v-else-if="currentStep === 1 || currentStep === 2"
          @click="nextStep"
          :disabled="currentStep === 1 && !canProceedFromClaudeConfig"
        >
          {{ t('mcpCatalog.form.navigation.next') }}
        </Button>

        <!-- Submit button for final step -->
        <Button
          v-else
          @click="submitForm"
          :disabled="!canSubmit"
          :loading="isSubmitting"
          :loading-text="t('mcpCatalog.form.navigation.creating')"
        >
          {{ t('mcpCatalog.form.navigation.submit') }}
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
