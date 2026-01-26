<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { DsProgressSteps, type ProgressStep } from '@/components/ui/ds-progress-steps'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Settings } from 'lucide-vue-next'
import ConnectGitHubStep from '@/components/deploy/steps/ConnectGitHubStep.vue'
import SelectRepositoryStep from '@/components/deploy/steps/SelectRepositoryStep.vue'
import SelectSatelliteStep from '@/components/deploy/steps/SelectSatelliteStep.vue'
import ConfigureEnvironmentStep from '@/components/deploy/steps/ConfigureEnvironmentStep.vue'
import ValidatingDeploymentStep from '@/components/deploy/steps/ValidatingDeploymentStep.vue'
import StreamingLogsStep from '@/components/deploy/steps/StreamingLogsStep.vue'
import DeploymentSuccessStep from '@/components/deploy/steps/DeploymentSuccessStep.vue'
import { DeploymentService } from '@/services/deploymentService'
import { useTeamContext } from '@/composables/useTeamContext'
import { toast } from 'vue-sonner'

const { t } = useI18n()
const router = useRouter()

// Team context using composable
const { selectedTeam, teamId, isLoading: isLoadingTeam, allowGithubMcp } = useTeamContext()

const currentStep = ref(0)
const completedSteps = ref<number[]>([])
const featureDisabled = ref(false)
const isCheckingFeature = ref(true)

const formData = ref({
  repository: {
    url: '',
    name: '',
    branch: 'main'
  },
  satellite: {
    satellite_id: ''
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
const isDeploying = ref(false)
const deploymentError = ref<{ error: string; step: string } | null>(null)

const progressSteps = computed<ProgressStep[]>(() => [
  {
    id: 1,
    title: t('deployments.wizard.steps.connectGitHub'),
    description: t('deployments.wizard.stepDescriptions.connectGitHub')
  },
  {
    id: 2,
    title: t('deployments.wizard.steps.selectRepository'),
    description: t('deployments.wizard.stepDescriptions.selectRepository')
  },
  {
    id: 3,
    title: t('deployments.wizard.steps.selectSatellite'),
    description: t('deployments.wizard.stepDescriptions.selectSatellite')
  },
  {
    id: 4,
    title: t('deployments.wizard.steps.configureEnvironment'),
    description: t('deployments.wizard.stepDescriptions.configureEnvironment')
  },
  {
    id: 5,
    title: t('deployments.wizard.steps.validate'),
    description: t('deployments.wizard.stepDescriptions.validate')
  },
  {
    id: 6,
    title: t('deployments.wizard.steps.streaming'),
    description: t('deployments.wizard.stepDescriptions.streaming')
  },
  {
    id: 7,
    title: t('deployments.wizard.steps.success'),
    description: t('deployments.wizard.stepDescriptions.success')
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

function handleGitHubConnected() {
  // GitHub is connected, wizard will auto-advance
}

async function handleDeploy() {
  try {
    if (!teamId.value) {
      toast.error('No team selected')
      return
    }

    // Move to Step 5 (Validating) immediately
    nextStep()
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

    // Move to Step 5 (Streaming Logs)
    nextStep()
  } catch (error) {
    isDeploying.value = false
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Check if error has step information (from backend validation)
    deploymentError.value = {
      error: errorMessage,
      step: 'deployment_failed'
    }

    // Stay on Step 4 to show error
  }
}

function handleRetryDeploy() {
  // Go back to Step 4 (Configure Environment) to retry
  currentStep.value = 3
  deploymentError.value = null
}

function handleCancelStreaming() {
  // Go back to beginning or list
  router.push('/deploy')
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
        max-width="max-w-3xl"
      >
        <!-- Step 1: Connect GitHub -->
        <template #step-content-0>
          <ConnectGitHubStep
            @connected="handleGitHubConnected"
            @next="nextStep"
          />
        </template>

        <!-- Step 2: Select Repository -->
        <template #step-content-1>
          <SelectRepositoryStep
            v-model="formData.repository"
            @next="nextStep"
            @back="previousStep"
          />
        </template>

        <!-- Step 3: Select Satellite -->
        <template #step-content-2>
          <SelectSatelliteStep
            v-model="formData.satellite"
            @next="nextStep"
            @back="previousStep"
          />
        </template>

        <!-- Step 4: Configure Environment -->
        <template #step-content-3>
          <ConfigureEnvironmentStep
            v-model="formData.config"
            :repository-name="formData.repository.name"
            :branch="formData.repository.branch"
            @deploy="handleDeploy"
            @back="previousStep"
          />
        </template>

        <!-- Step 5: Validating Deployment -->
        <template #step-content-4>
          <ValidatingDeploymentStep
            :is-loading="isDeploying"
            :error="deploymentError"
            @back="previousStep"
            @retry="handleRetryDeploy"
          />
        </template>

        <!-- Step 6: Streaming Logs & Status -->
        <template #step-content-5>
          <StreamingLogsStep
            :installation-id="formData.deployment.installation_id"
            @next="nextStep"
            @cancel="handleCancelStreaming"
          />
        </template>

        <!-- Step 7: Success -->
        <template #step-content-6>
          <DeploymentSuccessStep
            :installation-id="formData.deployment.installation_id"
            :repository-name="formData.repository.name"
            :branch="formData.repository.branch"
            :commit-sha="formData.deployment.commit_sha"
          />
        </template>
      </DsProgressSteps>
    </div>
  </NavbarLayout>
</template>
