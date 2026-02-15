<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DsStepper, type WizardStep } from '@/components/ui/ds-stepper'
import { DsCard } from '@/components/ui/ds-card'
import { FileText, Github, Settings } from 'lucide-vue-next'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import GitHubRepositoryStep from '@/components/admin/mcp-catalog/GitHubRepositoryStep.vue'
import ClaudeDesktopConfigStep from '@/components/admin/mcp-catalog/ClaudeDesktopConfigStep.vue'
import ConfigurationSchemaStepAdd from '@/components/admin/mcp-catalog/steps/ConfigurationSchemaStepAdd.vue'
import BasicInfoStepAdd from '@/components/admin/mcp-catalog/steps/BasicInfoStepAdd.vue'
import type { McpServerFormData } from '@/views/admin/mcp-server-catalog/types'
import { useRuntimeDetection } from '@/composables/admin/mcp-catalog'

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
const { detectRuntimeFromCommand } = useRuntimeDetection()

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
    skip_oauth_flow: boolean
    transport_type: string
    website_url: string
    icon_url: string
    language: string
    runtime: string
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

// Wizard steps for WizardStepper component
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
    skip_oauth_flow: false,
    transport_type: 'auto',
    website_url: '',
    icon_url: '',
    language: 'typescript',
    runtime: 'node'
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
  readme: {
    github_readme_base64: ''
  },
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
  const config = formData.value.claudeConfig.claude_desktop_config as any

  if (!config || Object.keys(config).length === 0) {
    return false
  }

  // Check if this is an HTTP config (fake structure with 'remote-server')
  if (config.mcpServers && config.mcpServers['remote-server']) {
    const remoteServer = config.mcpServers['remote-server']
    // For HTTP: URL must be non-empty and valid
    if (!remoteServer.url || remoteServer.url.trim() === '') {
      return false
    }
    // Strict URL validation
    try {
      const parsedUrl = new URL(remoteServer.url)

      // Must use HTTP or HTTPS
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return false
      }

      // Must have a valid hostname (not empty, not just a single character)
      const hostname = parsedUrl.hostname
      if (!hostname || hostname.length < 2) {
        return false
      }

      // For non-localhost, require at least one dot (domain.tld format)
      if (hostname !== 'localhost' && !hostname.includes('.')) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  // For stdio config: if we got here, it's valid (already validated in StdioServerInput)
  return true
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

// Handle step click from WizardStepper
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

    // If moving to the Basic Info step (index 3), populate language and runtime from detected values
    if (currentStep.value === 3) {
      const claudeConfig = formData.value.claudeConfig.claude_desktop_config as any
      let serverConfig: any = null

      if (claudeConfig && claudeConfig.mcpServers) {
        const serverKey = Object.keys(claudeConfig.mcpServers)[0]
        serverConfig = serverKey ? claudeConfig.mcpServers[serverKey] : null
      }

      // Detect language and runtime
      let detectedLanguage = 'typescript'
      let detectedRuntime = 'node'

      if (serverConfig) {
        if (serverConfig.url) {
          // HTTP/SSE servers
          detectedLanguage = 'http'
          detectedRuntime = 'http'
        } else if (serverConfig.command) {
          // STDIO servers - detect from command
          const detection = detectRuntimeFromCommand(serverConfig.command)
          detectedLanguage = detection.language
          detectedRuntime = detection.runtime
        }
      }

      // Update form data with detected values
      formData.value.basic.language = detectedLanguage
      formData.value.basic.runtime = detectedRuntime
    }

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
    website_url: repositoryData.homepage || '',
    icon_url: repositoryData.owner?.avatar_url || repositoryData.icon_url || '',
    // Keep existing values for these properties
    featured: formData.value.basic.featured,
    auto_install_new_default_team: formData.value.basic.auto_install_new_default_team,
    skip_oauth_flow: formData.value.basic.skip_oauth_flow,
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
    let serverConfig: any = null;

    if (claudeConfig && claudeConfig.mcpServers) {
      const serverKey = Object.keys(claudeConfig.mcpServers)[0];
      serverConfig = serverKey ? claudeConfig.mcpServers[serverKey] : null;

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

    // Use language and runtime from the Basic Info form (user can edit these in step 4)
    // These values are auto-populated when navigating to step 4, but user can override them
    const finalLanguage = formData.value.basic.language || 'typescript'
    const finalRuntime = formData.value.basic.runtime || 'node'

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
      skip_oauth_flow: formData.value.basic.skip_oauth_flow,
      icon_url: formData.value.basic.icon_url,

      // New Configuration Schema (ADR-007)
      configuration_schema: formData.value.configuration_schema,

      // Also send Claude Desktop config for backend fallback
      claude_desktop_config: formData.value.claudeConfig.claude_desktop_config,

      // Properly extracted fields based on transport type
      language: finalLanguage,
      runtime: finalRuntime,
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
    }

    // Include website_url from basic info (can be manually entered or auto-populated)
    if (formData.value.basic.website_url && formData.value.basic.website_url.trim() !== '') {
      finalPayload.website_url = formData.value.basic.website_url;
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

      <!-- Step 1: GitHub Repository -->
      <DsCard v-if="currentStep === 0" :title="t('mcpCatalog.form.steps.github')">
      <GitHubRepositoryStep
        v-model="formData.repository"
        :form-data="compatibleFormData"
      />

      <!-- GitHub Fetch Error -->
      <Alert v-if="githubFetchError" variant="destructive" class="mt-4">
        <AlertDescription>
          {{ githubFetchError }}
          <br>
          <span class="text-sm">{{ t('mcpCatalog.validation.githubUrlInvalid') }}</span>
        </AlertDescription>
      </Alert>

      <template #footer-actions>
        <Button variant="outline" @click="handleCancel">
          {{ cancelText }}
        </Button>
        <Button
          @click="handleGitHubStepNext"
          :disabled="!canProceedFromGitHub || isFetchingGitHub"
          class="min-w-[120px]"
        >
          <Spinner v-if="isFetchingGitHub" class="mr-2" />
          {{ t('mcpCatalog.form.navigation.next') }}
        </Button>
      </template>
    </DsCard>

    <!-- Step 2: Claude Desktop Config -->
    <DsCard v-else-if="currentStep === 1" :title="t('mcpCatalog.form.steps.claudeConfig')">
      <ClaudeDesktopConfigStep v-model="formData.claudeConfig" />

      <template #footer-actions>
        <Button variant="outline" @click="previousStep">
          {{ t('mcpCatalog.form.navigation.previous') }}
        </Button>
        <Button
          @click="nextStep"
          :disabled="!canProceedFromClaudeConfig"
        >
          {{ t('mcpCatalog.form.navigation.next') }}
        </Button>
      </template>
    </DsCard>

    <!-- Step 3: Configuration Schema (uses its own DsCards for each section) -->
    <div v-else-if="currentStep === 2">
      <ConfigurationSchemaStepAdd
        v-model="formData.configuration_schema"
        :claudeConfig="formData.claudeConfig"
      />

      <!-- Navigation buttons -->
      <div class="flex justify-end gap-2 mt-6">
        <Button variant="outline" @click="previousStep">
          {{ t('mcpCatalog.form.navigation.previous') }}
        </Button>
        <Button @click="nextStep">
          {{ t('mcpCatalog.form.navigation.next') }}
        </Button>
      </div>
    </div>

    <!-- Step 4: Basic Info -->
    <DsCard v-else-if="currentStep === 3" :title="t('mcpCatalog.form.steps.basic')">
      <BasicInfoStepAdd
        v-model="formData.basic"
        :form-data="compatibleFormData"
      />

      <template #footer-actions>
        <Button variant="outline" @click="previousStep">
          {{ t('mcpCatalog.form.navigation.previous') }}
        </Button>
        <Button
          @click="submitForm"
          :disabled="!canSubmit || isSubmitting"
        >
          <Spinner v-if="isSubmitting" class="mr-2" />
          {{ t('mcpCatalog.form.navigation.submit') }}
        </Button>
      </template>
    </DsCard>
    </div>
  </div>
</template>
