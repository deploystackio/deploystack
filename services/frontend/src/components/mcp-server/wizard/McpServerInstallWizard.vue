<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Server, Settings, Cloud, Loader2 } from 'lucide-vue-next'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { useEventBus } from '@/composables/useEventBus'
import McpServerSelectionStep from './McpServerSelectionStep.vue'
import EnvironmentVariablesStep from './EnvironmentVariablesStep.vue'
import PlatformSelectionStep from './PlatformSelectionStep.vue'

// Emits
const emit = defineEmits<{
  complete: [installationData: any]
  cancel: []
}>()

const { t } = useI18n()
const eventBus = useEventBus()

// Form data interface
interface InstallationFormData {
  server: {
    mcp_server_id: string
    server_data?: any
  }
  environment: {
    environment_variables: Record<string, string>
  }
  platform: {
    platform: string
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

// State
const currentStep = ref(0)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const environmentValidation = ref({
  isValid: true,
  missingFields: [] as string[]
})
const environmentStepTouched = ref(false)

// Form data with proper initialization
const formData = ref<InstallationFormData>({
  server: {
    mcp_server_id: ''
  },
  environment: {
    environment_variables: {}
  },
  platform: {
    platform: 'local'
  }
})

// Computed properties
const isFirstStep = computed(() => currentStep.value === 0)
const isLastStep = computed(() => currentStep.value === steps.length - 1)
const canGoNext = computed(() => !isLastStep.value)
const canGoPrevious = computed(() => !isFirstStep.value)

const canProceedFromServer = computed(() => {
  return formData.value.server.mcp_server_id !== ''
})

const canProceedFromEnvironment = computed(() => {
  // Use the validation state from the EnvironmentVariablesStep component
  return environmentValidation.value.isValid
})

const canSubmit = computed(() => {
  return formData.value.server.mcp_server_id &&
         formData.value.platform.platform &&
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
  }

  if (canGoNext.value) {
    currentStep.value++
  }
}

const previousStep = () => {
  if (canGoPrevious.value) {
    currentStep.value--
  }
}

const handleCancel = () => {
  emit('cancel')
}

// Form submission
const submitInstallation = async () => {
  try {
    isSubmitting.value = true
    submitError.value = null

    // Prepare installation data
    const installationData = {
      mcp_server_id: formData.value.server.mcp_server_id,
      platform: formData.value.platform.platform,
      environment_variables: formData.value.environment.environment_variables,
      status: 'pending',
      installation_name: formData.value.server.server_data?.name || 'Unknown Server'
    }

    // Call backend API to create installation
    const response = await McpInstallationService.createInstallation(installationData)

    if (response.success) {
      emit('complete', {
        ...installationData,
        id: response.data.id
      })
    } else {
      throw new Error(response.message || 'Failed to create installation')
    }

  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Failed to submit installation'
  } finally {
    isSubmitting.value = false
  }
}

// Handle server selection change
const handleServerSelected = (serverData: any) => {
  formData.value.server.server_data = serverData

  // Reset environment variables when server changes
  formData.value.environment.environment_variables = {}

  // Reset touched state when server changes
  environmentStepTouched.value = false

  // Pre-populate environment variables with default values
  if (serverData.environment_variables) {
    serverData.environment_variables.forEach((env: any) => {
      if (env.placeholder && env.placeholder !== `<insert-your-${env.name.toLowerCase()}-here>`) {
        formData.value.environment.environment_variables[env.name] = env.placeholder
      } else {
        formData.value.environment.environment_variables[env.name] = ''
      }
    })
  }
}

// Handle validation changes from EnvironmentVariablesStep
const handleValidationChange = (isValid: boolean, missingFields: string[]) => {
  environmentValidation.value = {
    isValid,
    missingFields
  }
}

onMounted(() => {
  // Listen for wizard reset events
  eventBus.on('mcp-install-wizard-reset', () => {
    currentStep.value = 0
    formData.value = {
      server: { mcp_server_id: '' },
      environment: { environment_variables: {} },
      platform: { platform: 'local' }
    }
    submitError.value = null
  })
})
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumb Navigation -->
    <Breadcrumb>
      <BreadcrumbList>
        <template v-for="(step, index) in steps" :key="index">
          <BreadcrumbItem>
            <!-- Current Step -->
            <BreadcrumbPage v-if="index === currentStep" class="flex items-center gap-2">
              <component :is="step.icon" class="h-4 w-4" />
              <span>{{ step.label }}</span>
            </BreadcrumbPage>

            <!-- Completed Steps (clickable) -->
            <BreadcrumbLink
              v-else-if="index < currentStep"
              @click="goToStep(index)"
              class="flex items-center gap-2 cursor-pointer hover:text-foreground"
            >
              <component :is="step.icon" class="h-4 w-4" />
              <span>{{ step.label }}</span>
            </BreadcrumbLink>

            <!-- Future Steps (disabled) -->
            <span v-else class="flex items-center gap-2 text-muted-foreground">
              <component :is="step.icon" class="h-4 w-4" />
              <span>{{ step.label }}</span>
            </span>
          </BreadcrumbItem>

          <!-- Separator -->
          <BreadcrumbSeparator v-if="index < steps.length - 1" />
        </template>
      </BreadcrumbList>
    </Breadcrumb>

    <!-- Error Message -->
    <Alert v-if="submitError" variant="destructive">
      <AlertDescription>
        {{ submitError }}
      </AlertDescription>
    </Alert>

    <!-- Validation Error for Environment Variables (only show after user tries to proceed) -->
    <Alert v-if="currentStep === 1 && environmentStepTouched && !environmentValidation.isValid && environmentValidation.missingFields.length > 0" variant="destructive">
      <AlertDescription>
        {{ t('mcpInstallations.wizard.environment.missingRequiredFields') }}: {{ environmentValidation.missingFields.join(', ') }}
      </AlertDescription>
    </Alert>

    <!-- Step Content -->
    <div>
      <!-- Server Selection Step -->
      <McpServerSelectionStep
        v-if="currentStep === 0"
        v-model="formData.server.mcp_server_id"
        @server-selected="handleServerSelected"
      />

      <!-- Environment Variables Step -->
      <EnvironmentVariablesStep
        v-else-if="currentStep === 1"
        v-model="formData.environment.environment_variables"
        :server-data="formData.server.server_data"
        @validation-change="handleValidationChange"
      />

      <!-- Platform Selection Step -->
      <PlatformSelectionStep
        v-else-if="currentStep === 2"
        v-model="formData.platform.platform"
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
          :disabled="!canSubmit || isSubmitting"
        >
          <Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin mr-2" />
          {{ isSubmitting ? t('mcpInstallations.wizard.installing') : t('mcpInstallations.wizard.install') }}
        </Button>
      </div>
    </div>
  </div>
</template>
