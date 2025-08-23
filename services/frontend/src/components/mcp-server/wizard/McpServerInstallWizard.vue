<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ProgressBars } from '@/components/ui/progress-bars'
import { toast } from 'vue-sonner'
import { Server, Settings, Cloud } from 'lucide-vue-next'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService } from '@/services/teamService'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import McpServerSelectionStep from './McpServerSelectionStep.vue'
import EnvironmentVariablesStep from './EnvironmentVariablesStep.vue'
import PlatformSelectionStep from './PlatformSelectionStep.vue'

// Props
interface Props {
  initialServerId?: string
  initialStep?: number
}

withDefaults(defineProps<Props>(), {
  initialServerId: '',
  initialStep: 0
})

// Emits
const emit = defineEmits<{
  complete: [installationData: any]
  cancel: []
}>()

const { t } = useI18n()
const route = useRoute()
const eventBus = useEventBus()

// Form data interface
interface InstallationFormData {
  server: {
    server_id: string
    server_data?: any
  }
  environment: {
    team_args: string[]
    team_env: Record<string, string>
    user_env: Record<string, string>
  }
  platform: {
    installation_type: string
    platform_config?: any
  }
}

// Form steps configuration
const steps = [
  {
    key: 'server' as const,
    label: t('mcpInstallations.wizard.steps.selectServer'),
    icon: Server,
    component: McpServerSelectionStep
  },
  {
    key: 'environment' as const,
    label: t('mcpInstallations.wizard.steps.configureEnvironment'),
    icon: Settings,
    component: EnvironmentVariablesStep
  },
  {
    key: 'platform' as const,
    label: t('mcpInstallations.wizard.steps.selectPlatform'),
    icon: Cloud,
    component: PlatformSelectionStep
  }
]

// Progress bar steps - convert steps to ProgressBars format
const progressSteps = computed(() => {
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
      status,
      clickable: index < currentStep.value // Only allow clicking on completed steps
    }
  })
})

// Calculate progress percentage
const progressPercentage = computed(() => {
  return (currentStep.value / (steps.length - 1)) * 100
})

// Handle step click from progress bar
const handleStepClick = (step: any, index: number) => {
  if (index < currentStep.value) {
    goToStep(index)
  }
}

// State
const currentStep = ref(0)
const isSubmitting = ref(false)

const environmentValidation = ref({
  isValid: true,
  missingFields: [] as string[]
})
const environmentStepTouched = ref(false)
const currentTeamId = ref<string | null>(null)

// Form data with proper initialization
const formData = ref<InstallationFormData>({
  server: {
    server_id: ''
  },
  environment: {
    team_args: [],
    team_env: {},
    user_env: {}
  },
  platform: {
    installation_type: 'local'
  }
})

// Computed properties
const isFirstStep = computed(() => currentStep.value === 0)
const isLastStep = computed(() => currentStep.value === steps.length - 1)
const canGoNext = computed(() => !isLastStep.value)
const canGoPrevious = computed(() => !isFirstStep.value)

const canProceedFromServer = computed(() => {
  return formData.value.server.server_id !== ''
})

const canProceedFromEnvironment = computed(() => {
  // If no server is selected, can't proceed
  if (!formData.value.server.server_id) {
    return false
  }

  // Use the validation state from the EnvironmentVariablesStep component
  return environmentValidation.value.isValid
})

const canSubmit = computed(() => {
  return formData.value.server.server_id &&
         formData.value.platform.installation_type &&
         canProceedFromEnvironment.value
})

// Navigation methods
const goToStep = (stepIndex: number) => {
  if (stepIndex >= 0 && stepIndex < currentStep.value) {
    currentStep.value = stepIndex
  }
}

const nextStep = () => {
  // Mark environment step as touched when user tries to proceed from it
  if (currentStep.value === 1) {
    environmentStepTouched.value = true

    // Check validation before proceeding
    if (!environmentValidation.value.isValid) {
      // Show error toast for missing required fields
      if (environmentValidation.value.missingFields.length > 0) {
        toast.error(t('mcpInstallations.wizard.environment.missingRequiredFields'), {
          description: environmentValidation.value.missingFields.join(', ')
        })
      }
      return
    }
  }

  if (canGoNext.value) {
    currentStep.value++
  }
}

const previousStep = () => {
  if (canGoPrevious.value) {
    currentStep.value--

    // Reset form data when going back to previous steps
    if (currentStep.value === 0) {
      // Going back to server selection - clear server data
      formData.value.server.server_id = ''
      formData.value.server.server_data = undefined
      formData.value.environment.team_env = {}
      formData.value.environment.user_env = {}
      environmentStepTouched.value = false
    } else if (currentStep.value === 1) {
      // Going back to environment step - clear platform data
      formData.value.platform.installation_type = 'local'
      formData.value.platform.platform_config = undefined
    }
  }
}

const handleCancel = () => {
  emit('cancel')
}

// Initialize team context from event bus storage
const initializeTeamContext = async () => {
  try {
    const userTeams = await TeamService.getUserTeams()
    if (userTeams.length > 0) {
      const storedTeamId = eventBus.getState<string>('selected_team_id')

      if (storedTeamId) {
        // Try to find the stored team in available teams
        const storedTeam = userTeams.find(team => team.id === storedTeamId)
        if (storedTeam) {
          currentTeamId.value = storedTeam.id
        } else {
          // Stored team not found, fallback to default team
          const defaultTeam = userTeams.find(team => team.is_default) || userTeams[0]
          if (defaultTeam) {
            currentTeamId.value = defaultTeam.id
            eventBus.setState('selected_team_id', defaultTeam.id)
          }
        }
      } else {
        // No stored team, use default team
        const defaultTeam = userTeams.find(team => team.is_default) || userTeams[0]
        if (defaultTeam) {
          currentTeamId.value = defaultTeam.id
          eventBus.setState('selected_team_id', defaultTeam.id)
        }
      }
    }
  } catch (error) {
    console.error('Error initializing team context:', error)
    toast.error('Failed to initialize team context', {
      description: 'Please refresh the page and try again.'
    })
  }
}

// Form submission
const submitInstallation = async () => {
  try {
    isSubmitting.value = true

    // Ensure we have a team ID
    if (!currentTeamId.value) {
      throw new Error('No team selected. Please refresh the page and try again.')
    }

    // Prepare installation data aligned with backend API
    const installationData = {
      server_id: formData.value.server.server_id,
      installation_type: formData.value.platform.installation_type,
      team_args: formData.value.environment.team_args,
      team_env: formData.value.environment.team_env,
      user_environment_variables: formData.value.environment.user_env,
      installation_name: formData.value.server.server_data?.name || 'Unknown Server'
    }

    // Call backend API to create installation with real team ID
    const response = await McpInstallationService.createInstallation(currentTeamId.value, installationData)

    if (response.success) {
      emit('complete', {
        ...installationData,
        id: response.data.id
      })
    } else {
      throw new Error(response.message || 'Failed to create installation')
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to submit installation'
    toast.error(t('mcpInstallations.notifications.installError', { error: errorMessage }), {
      description: t('mcpInstallations.wizard.environment.helpText')
    })
  } finally {
    isSubmitting.value = false
  }
}

// Handle server selection change
const handleServerSelected = (serverData: any) => {
  formData.value.server.server_data = serverData

  // Reset environment variables when server changes
  formData.value.environment.team_args = []
  formData.value.environment.team_env = {}
  formData.value.environment.user_env = {}

  // Reset touched state when server changes
  environmentStepTouched.value = false

  // Reset validation state when server changes
  environmentValidation.value = {
    isValid: true, // Will be updated by the component
    missingFields: []
  }

  // Pre-populate team arguments with empty values from new schema
  if (serverData.team_args_schema) {
    try {
      const teamArgsSchema = typeof serverData.team_args_schema === 'string'
        ? JSON.parse(serverData.team_args_schema)
        : serverData.team_args_schema

      if (Array.isArray(teamArgsSchema)) {
        formData.value.environment.team_args = new Array(teamArgsSchema.length).fill('')
      }
    } catch (error) {
      console.error('Error parsing team_args_schema:', error)
    }
  }

  // Pre-populate team and user environment variables with empty values from new schema
  if (serverData.team_env_schema) {
    try {
      const teamEnvSchema = typeof serverData.team_env_schema === 'string'
        ? JSON.parse(serverData.team_env_schema)
        : serverData.team_env_schema

      if (Array.isArray(teamEnvSchema)) {
        teamEnvSchema.forEach((env: any) => {
          formData.value.environment.team_env[env.name] = ''
        })
      }
    } catch (error) {
      console.error('Error parsing team_env_schema:', error)
    }
  }

  if (serverData.user_env_schema) {
    try {
      const userEnvSchema = typeof serverData.user_env_schema === 'string'
        ? JSON.parse(serverData.user_env_schema)
        : serverData.user_env_schema

      if (Array.isArray(userEnvSchema)) {
        userEnvSchema.forEach((env: any) => {
          formData.value.environment.user_env[env.name] = ''
        })
      }
    } catch (error) {
      console.error('Error parsing user_env_schema:', error)
    }
  }
}

// Handle validation changes from EnvironmentVariablesStep
const handleValidationChange = (isValid: boolean, missingFields: string[]) => {
  environmentValidation.value = {
    isValid,
    missingFields
  }
}

// Handle query parameters for pre-selection
const handleQueryParameters = async () => {
  const serverId = route.query.serverId as string
  const step = route.query.step as string

  if (serverId) {
    try {
      // Fetch server data from API
      const serverData = await McpCatalogService.getServerById(serverId)

      if (serverData) {
        // Pre-populate form data
        formData.value.server.server_id = serverId
        formData.value.server.server_data = serverData

        // Pre-populate environment variables with empty values from new schema
        if (serverData.user_env_schema) {
          try {
            const userEnvSchema = typeof serverData.user_env_schema === 'string'
              ? JSON.parse(serverData.user_env_schema)
              : serverData.user_env_schema

            if (Array.isArray(userEnvSchema)) {
              userEnvSchema.forEach((env: any) => {
                formData.value.environment.user_env[env.name] = ''
              })
            }
          } catch (error) {
            console.error('Error parsing user_env_schema:', error)
          }
        }

        // Set initial step if specified
        if (step === '2') {
          currentStep.value = 1 // Step 2 = index 1
        }
      }
    } catch (error) {
      console.error('Error loading server from query parameters:', error)
      toast.error(t('mcpInstallations.wizard.server.errorTitle'), {
        description: 'Failed to load the specified server. Please try again.'
      })
    }
  }
}

onMounted(async () => {
  // Initialize team context
  await initializeTeamContext()

  // Handle query parameters for pre-selection
  await handleQueryParameters()

  // Listen for wizard reset events
  eventBus.on('mcp-install-wizard-reset', () => {
    currentStep.value = 0
    formData.value = {
      server: { server_id: '' },
      environment: { team_args: [], team_env: {}, user_env: {} },
      platform: { installation_type: 'local' }
    }
  })
})
</script>

<template>
  <div class="space-y-6">
    <!-- Progress Navigation -->
    <ProgressBars
      :steps="progressSteps"
      :progress="progressPercentage"
      :title="t('mcpInstallations.wizard.title')"
      interactive
      styled
      @step-click="handleStepClick"
    />



    <!-- Step Content -->
    <div>
      <!-- Server Selection Step -->
      <McpServerSelectionStep
        v-if="currentStep === 0"
        v-model="formData.server.server_id"
        @server-selected="handleServerSelected"
        @next-step="nextStep"
      />

      <!-- Environment Variables Step -->
      <EnvironmentVariablesStep
        v-else-if="currentStep === 1"
        v-model="formData.environment"
        :server-data="formData.server.server_data"
        @validation-change="handleValidationChange"
      />

      <!-- Platform Selection Step -->
      <PlatformSelectionStep
        v-else-if="currentStep === 2"
        v-model="formData.platform.installation_type"
      />
    </div>

    <!-- Navigation Buttons -->
    <div class="flex items-center justify-between">
      <Button
        v-if="canGoPrevious"
        variant="outline"
        @click="previousStep"
      >
        {{ t('navigation.previous') }}
      </Button>
      <div v-else></div>

      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          @click="handleCancel"
        >
          {{ t('navigation.cancel') }}
        </Button>

        <!-- Next button for server selection -->
        <Button
          v-if="currentStep === 0"
          @click="nextStep"
          :disabled="!canProceedFromServer"
        >
          {{ t('navigation.next') }}
        </Button>

        <!-- Next button for environment variables -->
        <Button
          v-else-if="currentStep === 1"
          @click="nextStep"
          :disabled="!canProceedFromEnvironment"
        >
          {{ t('navigation.next') }}
        </Button>

        <!-- Install button for final step -->
        <Button
          v-else
          @click="submitInstallation"
          :disabled="!canSubmit"
          :loading="isSubmitting"
          :loading-text="t('mcpInstallations.wizard.installing')"
        >
          {{ t('mcpInstallations.wizard.install') }}
        </Button>
      </div>
    </div>
  </div>
</template>
