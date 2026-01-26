<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { DsProgressSteps, type ProgressStep } from '@/components/ui/ds-progress-steps'
import { toast } from 'vue-sonner'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { SatelliteService, type TeamSatellite } from '@/services/satelliteService'
import { useEventBus } from '@/composables/useEventBus'
import { useTeamContext } from '@/composables/useTeamContext'
import EnvironmentVariablesStep from './EnvironmentVariablesStep.vue'
import OAuthAuthorizationStep from './OAuthAuthorizationStep.vue'
import SatelliteSelectionStep from './SatelliteSelectionStep.vue'
import McpServerAvatar from '../McpServerAvatar.vue'
import McpServerDetailsSheet from './McpServerDetailsSheet.vue'

// Props - now receives server data directly
interface Props {
  serverId: string
  serverData: any
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  complete: [installationData: any]
  cancel: []
}>()

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()

// Team context using composable
const { teamId } = useTeamContext()

// Form data interface
interface InstallationFormData {
  environment: {
    team_args: string[]
    team_env: Record<string, string>
    team_headers: Record<string, string>
    team_url_query_params: Record<string, string>
    user_args: Record<string, string>
    user_env: Record<string, string>
    user_headers: Record<string, string>
    user_url_query_params: Record<string, string>
  }
  platform: {
    installation_type: string
    satellite_id: string
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

// Satellite selection state
const satellites = ref<TeamSatellite[]>([])
const isFetchingSatellites = ref(false)

// Form data with proper initialization
const formData = ref<InstallationFormData>({
  environment: {
    team_args: [],
    team_env: {},
    team_headers: {},
    team_url_query_params: {},
    user_args: {},
    user_env: {},
    user_headers: {},
    user_url_query_params: {}
  },
  platform: {
    installation_type: 'global',
    satellite_id: ''
  }
})

// Computed property to check if server requires OAuth
const requiresOAuth = computed(() => {
  return props.serverData?.requires_oauth === true
})

// Computed property to determine if satellite step should be shown
const shouldShowSatelliteStep = computed(() => {
  return satellites.value.length > 1
})

// Progress steps for DsProgressSteps component
const progressSteps = computed<ProgressStep[]>(() => {
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

  if (shouldShowSatelliteStep.value && currentStep.value > 0) {
    completed.push(0) // Satellite step completed
  }

  return completed
})

// Current progress step
const currentProgressStep = computed(() => {
  return currentStep.value
})

// Step navigation
const totalSteps = computed(() => {
  return shouldShowSatelliteStep.value ? 2 : 1
})
const isLastStep = computed(() => currentStep.value === totalSteps.value - 1)
const canGoNext = computed(() => !isLastStep.value)

const canSubmit = computed(() => {
  if (requiresOAuth.value) {
    return true
  }
  return environmentValidation.value.isValid
})

const nextStep = () => {
  if (canGoNext.value) {
    currentStep.value++
  }
}

const previousStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const handleCancel = () => {
  emit('cancel')
}

// Fetch available satellites for the team
const fetchSatellites = async () => {
  if (!teamId.value) {
    return
  }

  try {
    isFetchingSatellites.value = true
    const response = await SatelliteService.getTeamSatellites(teamId.value)
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
    satellites.value = []
  } finally {
    isFetchingSatellites.value = false
  }
}

// Initialize environment form from server data
const initializeEnvironmentForm = () => {
  const serverData = props.serverData
  if (!serverData) return

  // Pre-populate team arguments
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

  // Pre-populate team environment variables
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

  // Pre-populate user environment variables
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

// Form submission
const submitInstallation = async () => {
  try {
    isSubmitting.value = true

    if (!teamId.value) {
      throw new Error('No team selected. Please refresh the page and try again.')
    }

    const installationData = {
      server_id: props.serverId,
      installation_type: formData.value.platform.installation_type,
      satellite_id: formData.value.platform.satellite_id,
      team_args: formData.value.environment.team_args,
      team_env: formData.value.environment.team_env,
      team_headers: formData.value.environment.team_headers,
      team_url_query_params: formData.value.environment.team_url_query_params,
      user_args: formData.value.environment.user_args,
      user_environment_variables: formData.value.environment.user_env,
      user_headers: formData.value.environment.user_headers,
      user_url_query_params: formData.value.environment.user_url_query_params,
      installation_name: props.serverData?.name || 'Unknown Server'
    }

    const response = await McpInstallationService.createInstallation(teamId.value, installationData)

    if (response.success) {
      toast.success('Installation successful', {
        description: `${props.serverData?.name || 'MCP server'} has been installed.`
      })

      eventBus.emit('mcp-installations-updated')
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

    if (!teamId.value) {
      throw new Error('No team selected. Please refresh the page and try again.')
    }

    const authorizationData = {
      server_id: props.serverId,
      installation_name: props.serverData?.name || 'Unknown Server',
      installation_type: formData.value.platform.installation_type,
      satellite_id: formData.value.platform.satellite_id
    }

    const response = await McpInstallationService.startOAuthAuthorization(
      teamId.value,
      authorizationData
    )

    if (!response.requires_authorization) {
      toast.success('Installation successful', {
        description: 'MCP server has been installed.'
      })

      emit('complete', {
        ...authorizationData,
        id: response.flow_id
      })
      return
    }

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
  const backendUrl = new URL(import.meta.env.VITE_DEPLOYSTACK_BACKEND_URL || 'http://localhost:3000')
  const allowedOrigins = [window.location.origin, backendUrl.origin]

  if (!allowedOrigins.includes(event.origin)) {
    console.warn('Rejected postMessage from unauthorized origin:', event.origin)
    return
  }

  if (event.data.type === 'oauth_success') {
    if (oauthPopup.value && !oauthPopup.value.closed) {
      oauthPopup.value.close()
    }
    oauthPopup.value = null

    toast.success('Installation successful', {
      description: `${props.serverData?.name || 'MCP server'} has been installed and connected.`
    })

    eventBus.emit('mcp-installations-updated')
    router.push('/mcp-server')
  }

  else if (event.data.type === 'oauth_error') {
    const { error } = event.data

    if (oauthPopup.value && !oauthPopup.value.closed) {
      oauthPopup.value.close()
    }
    oauthPopup.value = null

    toast.error('Authentication failed', {
      description: error || 'OAuth authorization failed. Please try again.'
    })
  }
}

// Watch for serverData changes and reinitialize form
watch(() => props.serverData, () => {
  initializeEnvironmentForm()
}, { immediate: true })

// Watch for team changes and refetch satellites
watch(teamId, async (newTeamId) => {
  if (newTeamId) {
    await fetchSatellites()
  }
})

onMounted(async () => {
  // Wait for team context to load before fetching satellites
  if (teamId.value) {
    await fetchSatellites()
  }

  window.addEventListener('message', handleOAuthMessage)
})

onUnmounted(() => {
  window.removeEventListener('message', handleOAuthMessage)

  if (oauthPopup.value && !oauthPopup.value.closed) {
    oauthPopup.value.close()
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Server Info Card -->
    <div
      v-if="serverData"
      data-slot="card"
      class="text-card-foreground flex flex-col gap-6 rounded-xl border py-6 bg-white max-w-3xl mx-auto w-full"
    >
      <div class="px-6 md:flex md:items-center md:justify-between md:space-x-6 lg:space-x-8">
        <!-- Avatar Image -->
        <div class="flex-shrink-0 mb-4 md:mb-0 flex justify-center md:justify-start">
          <McpServerAvatar
            :icon-url="serverData.icon_url"
            :server-name="serverData.name"
            :size="72"
            rounded="lg"
          />
        </div>

        <!-- Server Info -->
        <div class="flex-auto text-sm text-gray-600">
          <!-- Server Name -->
          <p class="font-semibold text-gray-900">{{ serverData.name }}</p>

          <!-- Description -->
          <p v-if="serverData.description" class="mt-1 line-clamp-2">
            {{ serverData.description }}
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
            <Button variant="outline" @click="handleCancel" class="w-full sm:w-auto">
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

        <!-- Environment/OAuth Step (when satellite step is hidden) -->
        <div v-else>
          <!-- OAuth Authorization Step (if OAuth required) -->
          <OAuthAuthorizationStep
            v-if="requiresOAuth"
            :server-data="serverData"
            :is-authorizing="isSubmitting"
            @authorize="handleOAuthAuthorization"
          />

          <!-- Environment Variables Step (if OAuth NOT required) -->
          <EnvironmentVariablesStep
            v-else
            v-model="formData.environment"
            :server-data="serverData"
            @validation-change="handleValidationChange"
          />

          <!-- Navigation Buttons -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3 mt-8 sm:mt-6">
            <Button variant="outline" @click="handleCancel" class="w-full sm:w-auto">
              {{ t('navigation.cancel') }}
            </Button>

            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2">
              <!-- OAuth: "Authorize & Install" button -->
              <Button
                v-if="requiresOAuth"
                @click="handleOAuthAuthorization"
                :disabled="isSubmitting"
                class="w-full sm:w-auto"
              >
                <Spinner v-if="isSubmitting" class="mr-2" />
                {{ t('mcpInstallations.wizard.authorizeAndInstall') }}
              </Button>

              <!-- Non-OAuth: "Install" button -->
              <Button
                v-else
                @click="submitInstallation"
                :disabled="!canSubmit || isSubmitting"
                class="w-full sm:w-auto"
              >
                <Spinner v-if="isSubmitting" class="mr-2" />
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
          :server-data="serverData"
          :is-authorizing="isSubmitting"
          @authorize="handleOAuthAuthorization"
        />

        <!-- Environment Variables Step (if OAuth NOT required) -->
        <EnvironmentVariablesStep
          v-else
          v-model="formData.environment"
          :server-data="serverData"
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
              :disabled="isSubmitting"
              class="w-full sm:w-auto"
            >
              <Spinner v-if="isSubmitting" class="mr-2" />
              {{ t('mcpInstallations.wizard.authorizeAndInstall') }}
            </Button>

            <!-- Non-OAuth: "Install" button -->
            <Button
              v-else
              @click="submitInstallation"
              :disabled="!canSubmit || isSubmitting"
              class="w-full sm:w-auto"
            >
              <Spinner v-if="isSubmitting" class="mr-2" />
              {{ t('mcpInstallations.wizard.install') }}
            </Button>
          </div>
        </div>
      </template>
    </DsProgressSteps>

    <!-- Details Sheet -->
    <McpServerDetailsSheet
      v-model:open="isDetailsSheetOpen"
      :server="serverData ?? null"
    />
  </div>
</template>
