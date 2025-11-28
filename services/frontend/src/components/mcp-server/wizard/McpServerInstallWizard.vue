<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { DsProgressSteps, type ProgressStep } from '@/components/ui/ds-progress-steps'
import { toast } from 'vue-sonner'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService } from '@/services/teamService'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { SatelliteService, type TeamSatellite } from '@/services/satelliteService'
import { useEventBus } from '@/composables/useEventBus'
import McpServerSelectionStep from './McpServerSelectionStep.vue'
import EnvironmentVariablesStep from './EnvironmentVariablesStep.vue'
import OAuthAuthorizationStep from './OAuthAuthorizationStep.vue'
import SatelliteSelectionStep from './SatelliteSelectionStep.vue'
import McpServerAvatar from '../McpServerAvatar.vue'
import McpServerDetailsSheet from './McpServerDetailsSheet.vue'

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
const router = useRouter()
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
    team_headers: Record<string, string>
    team_url_query_params: Record<string, string>
    user_env: Record<string, string>
    user_url_query_params: Record<string, string>
  }
  platform: {
    installation_type: string
    satellite_id: string
    installation_id?: string
    platform_config?: any
  }
}

// State
const currentStep = ref(0)
const isSubmitting = ref(false)
const isDetailsSheetOpen = ref(false)

const environmentValidation = ref({
  isValid: true,
  missingFields: [] as string[]
})
const environmentStepTouched = ref(false)
const currentTeamId = ref<string | null>(null)

// Satellite selection state
const satellites = ref<TeamSatellite[]>([])
const isFetchingSatellites = ref(false)

// Form data with proper initialization
const formData = ref<InstallationFormData>({
  server: {
    server_id: ''
  },
  environment: {
    team_args: [],
    team_env: {},
    team_headers: {},
    team_url_query_params: {},
    user_env: {},
    user_url_query_params: {}
  },
  platform: {
    installation_type: 'global',
    satellite_id: ''
  }
})

// Computed property to check if server requires OAuth
const requiresOAuth = computed(() => {
  return formData.value.server.server_data?.requires_oauth === true
})

// Computed property to determine if satellite step should be shown
const shouldShowSatelliteStep = computed(() => {
  return satellites.value.length > 1
})

// Progress steps for DsProgressSteps component
const progressSteps = computed<ProgressStep[]>(() => {
  // Skip the first step (server selection) for progress display
  const wizardSteps = []

  // Step 1: Satellite Selection (only if multiple satellites)
  if (shouldShowSatelliteStep.value) {
    wizardSteps.push({
      id: 1,
      title: t('mcpInstallations.wizard.satellite.title'),
      description: t('mcpInstallations.wizard.satellite.description')
    })
  }

  // Step 2: Environment or OAuth
  wizardSteps.push({
    id: shouldShowSatelliteStep.value ? 2 : 1,
    title: requiresOAuth.value
      ? 'OAuth Authorization'
      : t('mcpInstallations.wizard.steps.configureEnvironment'),
    description: requiresOAuth.value
      ? 'Authorize access to your account'
      : t('mcpInstallations.wizard.environment.helpText')
  })

  return wizardSteps
})

// Completed steps for progress indicator
const completedSteps = computed(() => {
  const completed: number[] = []

  // If satellite step is shown and we've passed it
  if (shouldShowSatelliteStep.value && currentStep.value > 1) {
    completed.push(0) // Satellite step completed
  }

  // If we're on the final step (environment/oauth)
  if (shouldShowSatelliteStep.value && currentStep.value > 2) {
    completed.push(1)
  } else if (!shouldShowSatelliteStep.value && currentStep.value > 1) {
    completed.push(0)
  }

  return completed
})

// Current progress step (adjusted for skipped server selection)
const currentProgressStep = computed(() => {
  if (currentStep.value === 0) return -1 // Server selection, no progress shown

  if (shouldShowSatelliteStep.value) {
    // With satellite step: Step 1 = satellite (progress 0), Step 2 = environment (progress 1)
    return currentStep.value - 1
  } else {
    // Without satellite step: Step 1 = environment (progress 0)
    return currentStep.value - 1
  }
})

// Additional computed properties
const totalSteps = computed(() => {
  // Server selection (0) + Satellite (1, conditional) + Environment/OAuth (2 or 1)
  return shouldShowSatelliteStep.value ? 3 : 2
})
const isFirstStep = computed(() => currentStep.value === 0)
const isLastStep = computed(() => currentStep.value === totalSteps.value - 1)
const canGoNext = computed(() => !isLastStep.value)
const canGoPrevious = computed(() => !isFirstStep.value)

const canProceedFromEnvironment = computed(() => {
  // If no server is selected, can't proceed
  if (!formData.value.server.server_id) {
    return false
  }

  // If OAuth is required, always allow proceeding (no validation needed for OAuth step)
  if (requiresOAuth.value) {
    return true
  }

  // Use the validation state from the EnvironmentVariablesStep component
  return environmentValidation.value.isValid
})

const canSubmit = computed(() => {
  return formData.value.server.server_id &&
         formData.value.platform.installation_type &&
         canProceedFromEnvironment.value
})

const nextStep = () => {
  // Determine which step we're on based on whether satellite step is shown
  const environmentStepIndex = shouldShowSatelliteStep.value ? 2 : 1

  // Mark environment step as touched when user tries to proceed from it
  if (currentStep.value === environmentStepIndex) {
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
    } else if (shouldShowSatelliteStep.value && currentStep.value === 1) {
      // Going back to satellite step - clear satellite selection
      formData.value.platform.satellite_id = ''
    } else if (!shouldShowSatelliteStep.value && currentStep.value === 1) {
      // No satellite step, going back to server selection (step 0) - already handled above
    }
  }
}

const handleCancel = () => {
  emit('cancel')
}

// Fetch available satellites for the team
const fetchSatellites = async () => {
  if (!currentTeamId.value) {
    return
  }

  try {
    isFetchingSatellites.value = true
    const response = await SatelliteService.getTeamSatellites(currentTeamId.value)
    satellites.value = response.data.satellites

    // Auto-select satellite if only one is available
    if (satellites.value.length === 1) {
      formData.value.platform.satellite_id = satellites.value[0]!.id
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch satellites'
    toast.error(t('mcpInstallations.wizard.satellite.errorFetching'), {
      description: errorMessage
    })
    // Set empty array on error to allow wizard to continue
    satellites.value = []
  } finally {
    isFetchingSatellites.value = false
  }
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
      team_headers: formData.value.environment.team_headers,
      team_url_query_params: formData.value.environment.team_url_query_params,
      user_environment_variables: formData.value.environment.user_env,
      user_url_query_params: formData.value.environment.user_url_query_params,
      installation_name: formData.value.server.server_data?.name || 'Unknown Server'
    }

    // Call backend API to create installation with real team ID
    const response = await McpInstallationService.createInstallation(currentTeamId.value, installationData)

    if (response.success) {
      // Show success toast
      toast.success('Installation successful', {
        description: `${formData.value.server.server_data?.name || 'MCP server'} has been installed.`
      })

      // Emit event to refresh installation list
      eventBus.emit('mcp-installations-updated')

      // Redirect to installation list
      router.push('/mcp-server')
    } else {
      throw new Error(response.message || 'Failed to create installation')
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to submit installation'
    toast.error(t('mcpInstallations.notifications.installError'), {
      description: errorMessage
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

// OAuth popup reference
const oauthPopup = ref<Window | null>(null)

// Handle OAuth authorization
const handleOAuthAuthorization = async () => {
  try {
    isSubmitting.value = true

    // Ensure we have a team ID
    if (!currentTeamId.value) {
      throw new Error('No team selected. Please refresh the page and try again.')
    }

    // Prepare authorization data
    const authorizationData = {
      server_id: formData.value.server.server_id,
      installation_name: formData.value.server.server_data?.name || 'Unknown Server',
      installation_type: formData.value.platform.installation_type
    }

    // Call backend to start OAuth flow
    const response = await McpInstallationService.startOAuthAuthorization(
      currentTeamId.value,
      authorizationData
    )

    // Check if OAuth is required
    if (!response.requires_authorization) {
      // Server doesn't require OAuth, should not reach here
      toast.success('Installation successful', {
        description: 'MCP server has been installed.'
      })

      emit('complete', {
        ...authorizationData,
        id: response.installation_id
      })
      return
    }

    // Open OAuth popup window
    const popupWidth = 600
    const popupHeight = 700
    const left = window.screenX + (window.outerWidth - popupWidth) / 2
    const top = window.screenY + (window.outerHeight - popupHeight) / 2

    oauthPopup.value = window.open(
      response.authorization_url,
      'OAuth Authentication',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
    )

    if (!oauthPopup.value) {
      throw new Error('Popup was blocked. Please allow popups for this site and try again.')
    }

    toast.info('Opening authentication window', {
      description: 'Please authorize DeployStack to access your account'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to start OAuth authorization'
    toast.error('Authorization failed', {
      description: errorMessage
    })
  } finally {
    isSubmitting.value = false
  }
}

// Handle OAuth popup messages
const handleOAuthMessage = (event: MessageEvent) => {
  // Security: Verify origin (allow both frontend and backend origins)
  const backendUrl = new URL(import.meta.env.VITE_DEPLOYSTACK_BACKEND_URL || 'http://localhost:3000')
  const allowedOrigins = [window.location.origin, backendUrl.origin]

  if (!allowedOrigins.includes(event.origin)) {
    console.warn('Rejected postMessage from unauthorized origin:', event.origin)
    return
  }

  // Handle success message
  if (event.data.type === 'oauth_success') {
    // Close popup if still open
    if (oauthPopup.value && !oauthPopup.value.closed) {
      oauthPopup.value.close()
    }
    oauthPopup.value = null

    // Show success toast
    toast.success('Installation successful', {
      description: `${formData.value.server.server_data?.name || 'MCP server'} has been installed and connected.`
    })

    // Emit event to refresh installation list
    eventBus.emit('mcp-installations-updated')

    // Redirect to installation list
    router.push('/mcp-server')
  }

  // Handle error message
  else if (event.data.type === 'oauth_error') {
    const { error } = event.data

    // Close popup if still open
    if (oauthPopup.value && !oauthPopup.value.closed) {
      oauthPopup.value.close()
    }
    oauthPopup.value = null

    // Show error toast
    toast.error('Authentication failed', {
      description: error || 'OAuth authorization failed. Please try again.'
    })
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

  // Fetch available satellites for the team
  await fetchSatellites()

  // Handle query parameters for pre-selection
  await handleQueryParameters()

  // Listen for OAuth popup messages
  window.addEventListener('message', handleOAuthMessage)

  // Listen for wizard reset events
  eventBus.on('mcp-install-wizard-reset', () => {
    currentStep.value = 0
    formData.value = {
      server: { server_id: '' },
      environment: { team_args: [], team_env: {}, team_headers: {}, team_url_query_params: {}, user_env: {}, user_url_query_params: {} },
      platform: { installation_type: 'global', satellite_id: '' }
    }
  })
})

// Cleanup on unmount
onUnmounted(() => {
  window.removeEventListener('message', handleOAuthMessage)

  // Close OAuth popup if still open
  if (oauthPopup.value && !oauthPopup.value.closed) {
    oauthPopup.value.close()
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Server Selection Step (shown when currentStep === 0) -->
    <McpServerSelectionStep
      v-if="currentStep === 0"
      v-model="formData.server.server_id"
      @server-selected="handleServerSelected"
      @next-step="nextStep"
    />

    <!-- Server Info Header + Progress Steps (shown after server selection) -->
    <template v-else>
      <!-- Server Info Card -->
      <div
        v-if="formData.server.server_data"
        data-slot="card"
        class="text-card-foreground flex flex-col gap-6 rounded-xl border py-6 bg-white max-w-3xl mx-auto w-full"
      >
        <div class="px-6 md:flex md:items-center md:justify-between md:space-x-6 lg:space-x-8">
          <!-- Avatar Image -->
          <div class="flex-shrink-0 mb-4 md:mb-0 flex justify-center md:justify-start">
            <McpServerAvatar
              :icon-url="formData.server.server_data.icon_url"
              :server-name="formData.server.server_data.name"
              :size="72"
              rounded="lg"
            />
          </div>

          <!-- Server Information Grid -->
          <dl class="flex-auto divide-y divide-gray-200 text-sm text-gray-600 md:grid md:grid-cols-2 md:gap-x-6 md:divide-y-0 md:w-80 md:flex-none lg:gap-x-8">
            <!-- Server Name -->
            <div class="max-md:flex max-md:justify-between max-md:py-4 max-md:first:pt-0 max-md:last:pb-0">
              <dt class="font-medium text-gray-900">{{ t('mcpInstallations.wizard.server.name') }}</dt>
              <dd class="md:mt-1">{{ formData.server.server_data.name }}</dd>
            </div>

            <!-- Author -->
            <div class="max-md:flex max-md:justify-between max-md:py-4 max-md:first:pt-0 max-md:last:pb-0">
              <dt class="font-medium text-gray-900">{{ t('mcpInstallations.wizard.server.author') }}</dt>
              <dd class="md:mt-1">
                {{ formData.server.server_data.organization || formData.server.server_data.author_name || 'Unknown' }}
              </dd>
            </div>
          </dl>

          <!-- Description -->
          <div v-if="formData.server.server_data.description" class="mt-4 md:mt-0 md:ml-6 lg:flex-1">
            <p class="text-sm text-gray-600">
              {{ formData.server.server_data.description }}
            </p>
          </div>

          <!-- Details Button -->
          <div class="flex items-center w-full md:w-auto mt-4 md:mt-0">
            <Button
              variant="outline"
              @click="isDetailsSheetOpen = true"
              class="bg-white w-full md:w-auto"
            >
              Details
            </Button>
          </div>
        </div>
      </div>

      <!-- Progress Steps -->
      <DsProgressSteps
        :steps="progressSteps"
        :current-step="currentProgressStep"
        :completed-steps="completedSteps"
        max-width="max-w-3xl"
      >
        <!-- Step Content 0: Satellite Selection if shown, otherwise Environment/OAuth -->
        <template #step-content-0>
          <!-- Satellite Selection (only if multiple satellites) -->
          <div v-if="shouldShowSatelliteStep">
            <SatelliteSelectionStep
              v-model="formData.platform.satellite_id"
              :satellites="satellites"
              :is-loading="isFetchingSatellites"
            />

            <!-- Navigation Buttons for Satellite Step -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3 mt-8 sm:mt-6">
              <Button variant="outline" @click="previousStep" class="w-full sm:w-auto">
                {{ t('navigation.previous') }}
              </Button>

              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2">
                <Button variant="ghost" @click="handleCancel" class="w-full sm:w-auto">
                  {{ t('navigation.cancel') }}
                </Button>

                <Button
                  @click="nextStep"
                  :disabled="!formData.platform.satellite_id"
                  class="w-full sm:w-auto"
                >
                  {{ t('navigation.next') }}
                </Button>
              </div>
            </div>
          </div>

          <!-- Environment/OAuth Step (when satellite step is hidden) -->
          <div v-else>
            <!-- OAuth Authorization Step (if OAuth required) -->
            <OAuthAuthorizationStep
              v-if="requiresOAuth"
              :server-data="formData.server.server_data"
              :is-authorizing="isSubmitting"
              @authorize="handleOAuthAuthorization"
            />

            <!-- Environment Variables Step (if OAuth NOT required) -->
            <EnvironmentVariablesStep
              v-else
              v-model="formData.environment"
              :server-data="formData.server.server_data"
              @validation-change="handleValidationChange"
            />

            <!-- Navigation Buttons -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3 mt-8 sm:mt-6">
              <Button variant="outline" @click="previousStep" class="w-full sm:w-auto">
                {{ t('navigation.previous') }}
              </Button>

              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2">
                <Button variant="ghost" @click="handleCancel" class="w-full sm:w-auto">
                  {{ t('navigation.cancel') }}
                </Button>

                <!-- OAuth: "Authorize & Install" button -->
                <Button
                  v-if="requiresOAuth"
                  @click="handleOAuthAuthorization"
                  :loading="isSubmitting"
                  :loading-text="t('mcpInstallations.wizard.authorizing')"
                  :disabled="!formData.platform.installation_type"
                  class="w-full sm:w-auto"
                >
                  {{ t('mcpInstallations.wizard.authorizeAndInstall') }}
                </Button>

                <!-- Non-OAuth: "Install" button -->
                <Button
                  v-else
                  @click="submitInstallation"
                  :disabled="!canSubmit"
                  :loading="isSubmitting"
                  :loading-text="t('mcpInstallations.wizard.installing')"
                  class="w-full sm:w-auto"
                >
                  {{ t('mcpInstallations.wizard.install') }}
                </Button>
              </div>
            </div>
          </div>
        </template>

        <!-- Environment/OAuth Step when satellite step is shown -->
        <template #step-content-1>
          <!-- OAuth Authorization Step (if OAuth required) -->
          <OAuthAuthorizationStep
            v-if="requiresOAuth"
            :server-data="formData.server.server_data"
            :is-authorizing="isSubmitting"
            @authorize="handleOAuthAuthorization"
          />

          <!-- Environment Variables Step (if OAuth NOT required) -->
          <EnvironmentVariablesStep
            v-else
            v-model="formData.environment"
            :server-data="formData.server.server_data"
            @validation-change="handleValidationChange"
          />

          <!-- Navigation Buttons -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3 mt-8 sm:mt-6">
            <Button variant="outline" @click="previousStep" class="w-full sm:w-auto">
              {{ t('navigation.previous') }}
            </Button>

            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2">
              <Button variant="ghost" @click="handleCancel" class="w-full sm:w-auto">
                {{ t('navigation.cancel') }}
              </Button>

              <!-- OAuth: "Authorize & Install" button -->
              <Button
                v-if="requiresOAuth"
                @click="handleOAuthAuthorization"
                :loading="isSubmitting"
                :loading-text="t('mcpInstallations.wizard.authorizing')"
                :disabled="!formData.platform.installation_type"
                class="w-full sm:w-auto"
              >
                {{ t('mcpInstallations.wizard.authorizeAndInstall') }}
              </Button>

              <!-- Non-OAuth: "Install" button -->
              <Button
                v-else
                @click="submitInstallation"
                :disabled="!canSubmit"
                :loading="isSubmitting"
                :loading-text="t('mcpInstallations.wizard.installing')"
                class="w-full sm:w-auto"
              >
                {{ t('mcpInstallations.wizard.install') }}
              </Button>
            </div>
          </div>
        </template>
      </DsProgressSteps>
    </template>

    <!-- Details Sheet -->
    <McpServerDetailsSheet
      v-model:open="isDetailsSheetOpen"
      :server="formData.server.server_data ?? null"
    />
  </div>
</template>
