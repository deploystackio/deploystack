<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { DsProgressSteps, DsProgressStepsFooter, type ProgressStep } from '@/components/ui/ds-progress-steps'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Settings } from 'lucide-vue-next'
import SelectRepositoryStep from '@/components/deploy/steps/SelectRepositoryStep.vue'
import SelectSatelliteStep from '@/components/deploy/steps/SelectSatelliteStep.vue'
import ConfigureEnvironmentStep from '@/components/deploy/steps/ConfigureEnvironmentStep.vue'
import ValidatingDeploymentStep from '@/components/deploy/steps/ValidatingDeploymentStep.vue'
import DeploymentProgressStep from '@/components/deploy/steps/DeploymentProgressStep.vue'
import { DeploymentService } from '@/services/deploymentService'
import { useTeamContext } from '@/composables/useTeamContext'
import { toast } from 'vue-sonner'

const { t } = useI18n()
const router = useRouter()

// Team context using composable
const { selectedTeam, teamId, isLoading: isLoadingTeam, allowGithubMcp } = useTeamContext()

const currentStep = ref(0)
const completedSteps = ref<number[]>([])
const loadingSteps = ref<number[]>([])
const featureDisabled = ref(false)
const isCheckingFeature = ref(true)

interface ValidationMetadata {
  name?: string
  version?: string
  description?: string
  runtime: 'node' | 'python' | 'go' | 'unknown'
  mcp_sdk: {
    detected: boolean
    version?: string
    package: string
    runtime: 'node' | 'python' | 'go' | 'unknown'
  }
  scripts?: {
    build?: string
    start?: string
    [key: string]: string | undefined
  }
  commit_sha: string
}

const formData = ref({
  repository: {
    url: '',
    name: '',
    branch: 'main'
  },
  satellite: {
    satellite_id: ''
  },
  validation: {
    metadata: null as ValidationMetadata | null,
    validated: false
  },
  config: {
    teamEnv: {} as Record<string, string>,
    templateArgs: [] as string[]
  },
  deployment: {
    installation_id: '',
    server_id: '',
    commit_sha: ''
  }
})

// State for validation step
const isValidating = ref(false)
const validationError = ref<{ error: string; step: string } | null>(null)

// State for deployment step
const isDeploying = ref(false)
const deploymentError = ref<{ error: string; step: string } | null>(null)
const isDeploymentOnline = ref(false)

const progressSteps = computed<ProgressStep[]>(() => [
  {
    id: 1,
    title: t('deployments.wizard.steps.selectRepository')
  },
  {
    id: 2,
    title: t('deployments.wizard.steps.selectSatellite')
  },
  {
    id: 3,
    title: t('deployments.wizard.steps.validate')
  },
  {
    id: 4,
    title: t('deployments.wizard.steps.configureEnvironment')
  },
  {
    id: 5,
    title: t('deployments.wizard.steps.deployProgress')
  }
])

const currentProgressStep = computed(() => currentStep.value)

function nextStep() {
  if (!completedSteps.value.includes(currentStep.value)) {
    completedSteps.value.push(currentStep.value)
  }
  currentStep.value++
}

function previousStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

async function handleValidate() {
  try {
    if (!teamId.value) {
      toast.error('No team selected')
      return
    }

    // Move to Step 3 (Validating) immediately
    nextStep()
    isValidating.value = true
    validationError.value = null

    // Call validation endpoint
    const result = await DeploymentService.validateRepository(teamId.value, {
      repository_url: formData.value.repository.url,
      branch: formData.value.repository.branch
    })

    // Store validation metadata
    formData.value.validation.metadata = result.metadata ?? null
    formData.value.validation.validated = true

    isValidating.value = false

    // DO NOT auto-advance - let user review validation results and manually click "Next"
  } catch (error) {
    isValidating.value = false
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    validationError.value = {
      error: errorMessage,
      step: 'validation_failed'
    }

    // Stay on Step 3 (Validate) to show error
  }
}

async function handleRetryValidation() {
  // Retry validation
  validationError.value = null
  isValidating.value = true

  try {
    if (!teamId.value) {
      toast.error('No team selected')
      return
    }

    // Call validation endpoint again
    const result = await DeploymentService.validateRepository(teamId.value, {
      repository_url: formData.value.repository.url,
      branch: formData.value.repository.branch
    })

    // Store validation metadata
    formData.value.validation.metadata = result.metadata ?? null
    formData.value.validation.validated = true

    isValidating.value = false

    // DO NOT auto-advance - let user review validation results
  } catch (error) {
    isValidating.value = false
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    validationError.value = {
      error: errorMessage,
      step: 'validation_failed'
    }
  }
}

async function handleDeploy() {
  try {
    if (!teamId.value) {
      toast.error('No team selected')
      return
    }

    isDeploying.value = true
    deploymentError.value = null

    // Call synchronous deployment endpoint
    const result = await DeploymentService.createDeployment(teamId.value, {
      repository_url: formData.value.repository.url,
      branch: formData.value.repository.branch,
      satellite_id: formData.value.satellite.satellite_id,
      team_env: formData.value.config.teamEnv,
      template_args: formData.value.config.templateArgs
    })

    // Store deployment result
    formData.value.deployment.installation_id = result.installation_id
    formData.value.deployment.server_id = result.server_id
    formData.value.deployment.commit_sha = result.commit_sha

    isDeploying.value = false

    // Move to Step 5 (Streaming Logs) and mark it as loading
    loadingSteps.value.push(4)
    nextStep()
  } catch (error) {
    isDeploying.value = false
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Check if error has step information (from backend validation)
    deploymentError.value = {
      error: errorMessage,
      step: 'deployment_failed'
    }

    // Stay on Step 3 (Configure & Deploy) to show error
  }
}

function handleRetryDeploy() {
  // Clear error and retry
  deploymentError.value = null
  handleDeploy()
}

function handleDeploymentOnline() {
  // Deployment is online, show footer button
  isDeploymentOnline.value = true

  // Mark step 4 as completed (stops the spinner in progress indicator)
  if (!completedSteps.value.includes(4)) {
    completedSteps.value.push(4)
  }

  // Remove loading state from step 4
  loadingSteps.value = loadingSteps.value.filter(step => step !== 4)
}

function handleViewInstallation() {
  // Navigate to installation detail page
  router.push(`/mcp-server/installation/${formData.value.deployment.installation_id}/general`)
}

onMounted(async () => {
  // Wait for team context to initialize
  const stopWatch = watch(
    () => isLoadingTeam.value,
    async (loading) => {
      if (!loading) {
        // Team finished loading
        stopWatch() // Stop watching immediately

        if (!teamId.value) {
          toast.error('Please select a team first')
          router.push('/deploy')
          return
        }

        // Check team permission first
        if (!allowGithubMcp.value) {
          featureDisabled.value = true
          isCheckingFeature.value = false
          return
        }

        // Check if deployment feature is enabled globally
        try {
          await DeploymentService.checkConnection(teamId.value)
          // If we get here without error, feature is enabled
          featureDisabled.value = false
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : ''
          if (errorMessage.includes('not enabled')) {
            featureDisabled.value = true
          } else {
            // Other errors can continue to wizard (will show in ConnectGitHubStep)
            featureDisabled.value = false
          }
        } finally {
          isCheckingFeature.value = false
        }
      }
    },
    { immediate: true }
  )
})

// Watch for team changes and re-check permissions
watch(selectedTeam, (newTeam) => {
  if (newTeam) {
    // Reset wizard state when team changes
    currentStep.value = 0
    completedSteps.value = []

    // Check if new team has GitHub MCP permission
    if (!allowGithubMcp.value) {
      featureDisabled.value = true
    } else {
      featureDisabled.value = false
    }
  }
})
</script>

<template>
  <NavbarLayout>
    <div class="max-w-4xl mx-auto py-6">
      <!-- Page Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">{{ t('deployments.wizard.title') }}</h1>
        <p class="text-muted-foreground">
          {{ t('deployments.wizard.description') }}
        </p>
      </div>

      <!-- Loading State - Show while checking team OR feature -->
      <div v-if="isLoadingTeam || isCheckingFeature" class="flex items-center justify-center py-24">
        <div class="flex flex-col items-center gap-4">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p class="text-muted-foreground">
            {{ isLoadingTeam ? 'Loading team...' : 'Checking deployment feature...' }}
          </p>
        </div>
      </div>

      <!-- Feature Disabled State -->
      <Empty v-else-if="featureDisabled" class="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Settings />
          </EmptyMedia>
          <EmptyTitle>GitHub Deployments Not Allowed</EmptyTitle>
          <EmptyDescription>
            GitHub MCP deployments are not enabled for this team. Please contact your team administrator or upgrade your team plan to enable this feature.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>

      <!-- Wizard Progress Steps -->
      <DsProgressSteps
        v-else-if="!isLoadingTeam && !isCheckingFeature"
        :steps="progressSteps"
        :current-step="currentProgressStep"
        :completed-steps="completedSteps"
        :loading-steps="loadingSteps"
        max-width="max-w-3xl"
        :hide-footer="true"
      >
        <!-- Step 1: Select Repository -->
        <template #step-content-0>
          <SelectRepositoryStep
            v-model="formData.repository"
            @next="nextStep"
            @back="previousStep"
          />
        </template>

        <template #step-footer-0>
          <DsProgressStepsFooter
            :next-button-text="$t('deployments.wizard.buttons.next')"
            :is-next-disabled="currentStep !== 0 || !formData.repository.url"
            @next="nextStep"
          />
        </template>

        <!-- Step 2: Select Satellite -->
        <template #step-content-1>
          <SelectSatelliteStep
            v-model="formData.satellite"
            @next="handleValidate"
            @back="previousStep"
          />
        </template>

        <template #step-footer-1>
          <DsProgressStepsFooter
            :next-button-text="$t('deployments.wizard.buttons.next')"
            :is-next-disabled="currentStep !== 1 || !formData.satellite.satellite_id"
            :is-next-loading="isValidating"
            @next="handleValidate"
          />
        </template>

        <!-- Step 3: Validate Repository -->
        <template #step-content-2>
          <ValidatingDeploymentStep
            :is-loading="isValidating"
            :error="validationError"
            :metadata="formData.validation.metadata"
            @back="previousStep"
            @retry="handleRetryValidation"
          />
        </template>

        <template #step-footer-2>
          <DsProgressStepsFooter
            v-if="validationError"
            :next-button-text="$t('deployments.wizard.validating.error.tryAgain')"
            :is-next-disabled="currentStep !== 2"
            @next="handleRetryValidation"
          />
          <DsProgressStepsFooter
            v-else-if="!isValidating && formData.validation.validated"
            :next-button-text="$t('deployments.wizard.buttons.next')"
            :is-next-disabled="currentStep !== 2"
            @next="nextStep"
          />
        </template>

        <!-- Step 4: Configure & Deploy -->
        <template #step-content-3>
          <ConfigureEnvironmentStep
            v-model="formData.config"
            :repository-name="formData.repository.name"
            :branch="formData.repository.branch"
            :error="deploymentError"
            @deploy="handleDeploy"
            @back="previousStep"
          />
        </template>

        <template #step-footer-3>
          <!-- Show "Try Again" button when error exists -->
          <DsProgressStepsFooter
            v-if="deploymentError"
            :next-button-text="$t('deployments.wizard.deployment.error.tryAgain')"
            :is-next-disabled="currentStep !== 3"
            next-button-class="bg-green-600 hover:bg-green-700 text-white"
            @next="handleRetryDeploy"
          />
          <!-- Show normal "Deploy" button otherwise -->
          <DsProgressStepsFooter
            v-else
            :next-button-text="$t('deployments.wizard.buttons.deploy')"
            :is-next-disabled="currentStep !== 3"
            :is-next-loading="isDeploying"
            :next-loading-text="$t('deployments.wizard.buttons.deploying')"
            next-button-class="bg-green-600 hover:bg-green-700 text-white"
            @next="handleDeploy"
          />
        </template>

        <!-- Step 5: Deployment Progress -->
        <template #step-content-4>
          <DeploymentProgressStep
            :installation-id="formData.deployment.installation_id"
            :repository-name="formData.repository.name"
            :branch="formData.repository.branch"
            :commit-sha="formData.deployment.commit_sha"
            @deployment-online="handleDeploymentOnline"
          />
        </template>

        <template #step-footer-4>
          <DsProgressStepsFooter
            v-if="currentStep === 4"
            :next-button-text="isDeploymentOnline ? $t('deployments.wizard.deployProgress.viewInstallation') : $t('deployments.wizard.deployProgress.deploying')"
            :is-next-disabled="!isDeploymentOnline"
            :is-next-loading="!isDeploymentOnline"
            @next="handleViewInstallation"
          />
        </template>
      </DsProgressSteps>
    </div>
  </NavbarLayout>
</template>
