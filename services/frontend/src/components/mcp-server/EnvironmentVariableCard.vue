<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings, Eye, EyeOff } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Props and model
const modelValue = defineModel<Record<string, string>>({ required: true })

interface Props {
  serverData?: any
  variables?: any[]
}

const props = defineProps<Props>()

// Emits for validation state
const emit = defineEmits<{
  'validation-change': [isValid: boolean, missingFields: string[]]
}>()

const { t } = useI18n()

// State
const showPasswords = ref<Record<string, boolean>>({})

// Computed
const environmentVariables = computed(() => {
  // First try the variables prop (passed from EnvironmentVariablesStep)
  if (props.variables && props.variables.length > 0) {
    return props.variables
  }
  // Fallback to serverData.environment_variables
  if (!props.serverData?.environment_variables) return []
  return props.serverData.environment_variables
})


const hasRequiredVariables = computed(() => {
  return environmentVariables.value.some((env: any) => env.required)
})

const hasOptionalVariables = computed(() => {
  return environmentVariables.value.some((env: any) => !env.required)
})

const requiredVariables = computed(() => {
  return environmentVariables.value.filter((env: any) => env.required)
})

const optionalVariables = computed(() => {
  return environmentVariables.value.filter((env: any) => !env.required)
})

const allRequiredFilled = computed(() => {
  return requiredVariables.value.every((env: any) => {
    const value = modelValue.value[env.name]
    // Check if value exists, is not empty, and is not a placeholder
    return value &&
           value.trim().length > 0 &&
           !isPlaceholderValue(value, env)
  })
})

const missingRequiredFields = computed(() => {
  return requiredVariables.value
    .filter((env: any) => {
      const value = modelValue.value[env.name]
      return !value ||
             value.trim().length === 0 ||
             isPlaceholderValue(value, env)
    })
    .map((env: any) => env.name)
})

// Helper function to check if a value is a placeholder
const isPlaceholderValue = (value: string, env: any) => {
  if (!value) return true

  const trimmedValue = value.trim()

  // Check against common placeholder patterns
  const placeholderPatterns = [
    env.placeholder,
    `<insert-your-${env.name.toLowerCase()}-here>`,
    `<your-${env.name.toLowerCase()}>`,
    `<${env.name.toLowerCase()}>`,
    'your-api-key-here',
    'your-token-here',
    'your-secret-here'
  ]

  return placeholderPatterns.some(pattern =>
    pattern && trimmedValue === pattern.trim()
  )
}

const validationState = computed(() => {
  const hasRequired = hasRequiredVariables.value
  const allFilled = allRequiredFilled.value
  const missing = missingRequiredFields.value

  return {
    isValid: !hasRequired || allFilled,
    missingFields: missing,
    hasRequiredFields: hasRequired
  }
})

// Methods
const togglePasswordVisibility = (envName: string) => {
  showPasswords.value[envName] = !showPasswords.value[envName]
}

const getInputType = (env: any) => {
  if (env.type === 'password' && !showPasswords.value[env.name]) {
    return 'password'
  }
  return 'text'
}

const isTextarea = (env: any) => {
  return env.type === 'textarea' ||
         (env.description && env.description.toLowerCase().includes('json')) ||
         (env.placeholder && env.placeholder.length > 100)
}

const updateValue = (envName: string, value: string) => {
  const newValues = { ...modelValue.value }
  newValues[envName] = value
  modelValue.value = newValues
}

// Watch for validation state changes and emit to parent
watch(validationState, (newState) => {
  emit('validation-change', newState.isValid, newState.missingFields)
}, { immediate: true })

// Watch for model value changes to trigger validation
watch(modelValue, () => {
  // Validation will be triggered by the validationState watcher
}, { deep: true })

// Watch for environment variables changes to initialize form values
watch(() => environmentVariables.value, (newVariables) => {
  if (newVariables && newVariables.length > 0) {
    const newValues: Record<string, string> = {}
    newVariables.forEach((env: any) => {
      // Keep existing values if they exist
      if (modelValue.value[env.name] !== undefined) {
        newValues[env.name] = modelValue.value[env.name]
      } else {
        // Set default/placeholder values
        if (env.placeholder && env.placeholder !== `<insert-your-${env.name.toLowerCase()}-here>`) {
          newValues[env.name] = env.placeholder
        } else {
          newValues[env.name] = ''
        }
      }
    })
    modelValue.value = newValues
  }
}, { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <!-- No Environment Variables -->
    <div v-if="!environmentVariables.length" class="text-center py-8">
      <Settings class="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        {{ t('mcpInstallations.wizard.environment.noVariables') }}
      </h3>
      <p class="text-gray-600">
        {{ t('mcpInstallations.wizard.environment.noVariablesDescription') }}
      </p>
    </div>

    <!-- Environment Variables Form -->
    <div v-else class="space-y-6">
      <!-- Server Info -->
      <Card v-if="serverData">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Settings class="h-5 w-5" />
            {{ serverData.name }}
          </CardTitle>
          <CardDescription>
            {{ t('mcpInstallations.wizard.environment.configureFor', { name: serverData.name }) }}
          </CardDescription>
        </CardHeader>
      </Card>


      <!-- Required Variables -->
      <div v-if="hasRequiredVariables" class="space-y-4">
        <h3 class="text-lg font-medium text-gray-900">
          {{ t('mcpInstallations.wizard.environment.requiredVariables') }}
        </h3>

        <div class="space-y-4">
          <div
            v-for="env in requiredVariables"
            :key="env.name"
            class="space-y-2"
          >
            <Label :for="env.name" class="text-sm font-medium">
              {{ env.name }}
            </Label>

            <!-- Textarea for long values -->
            <div v-if="isTextarea(env)" class="relative">
              <Textarea
                :id="env.name"
                :value="modelValue[env.name] || ''"
                @input="updateValue(env.name, ($event.target as HTMLTextAreaElement).value)"
                :placeholder="env.placeholder || `Enter ${env.name}`"
                class="min-h-[100px]"
                :class="{ 'border-red-500': env.required && isPlaceholderValue(modelValue[env.name] || '', env) }"
              />
            </div>

            <!-- Regular input -->
            <div v-else class="relative">
              <Input
                :id="env.name"
                :type="getInputType(env)"
                :value="modelValue[env.name] || ''"
                @input="updateValue(env.name, ($event.target as HTMLInputElement).value)"
                :placeholder="env.placeholder || `Enter ${env.name}`"
                :class="{ 'border-red-500': env.required && isPlaceholderValue(modelValue[env.name] || '', env) }"
              />

              <!-- Password toggle -->
              <Button
                v-if="env.type === 'password'"
                type="button"
                variant="ghost"
                size="sm"
                class="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                @click="togglePasswordVisibility(env.name)"
              >
                <Eye v-if="!showPasswords[env.name]" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </Button>
            </div>

            <!-- Validation message -->
            <p v-if="env.validation" class="text-xs text-gray-600">
              {{ env.validation }}
            </p>
          </div>
        </div>
      </div>

      <!-- Optional Variables -->
      <div v-if="hasOptionalVariables" class="space-y-4">
        <h3 class="text-lg font-medium text-gray-900">
          {{ t('mcpInstallations.wizard.environment.optionalVariables') }}
        </h3>

        <div class="space-y-4">
          <div
            v-for="env in optionalVariables"
            :key="env.name"
            class="space-y-2"
          >
            <Label :for="env.name" class="text-sm font-medium">
              {{ env.name }}
            </Label>

            <!-- Textarea for long values -->
            <div v-if="isTextarea(env)" class="relative">
              <Textarea
                :id="env.name"
                :value="modelValue[env.name] || ''"
                @input="updateValue(env.name, ($event.target as HTMLTextAreaElement).value)"
                :placeholder="env.placeholder || `Enter ${env.name} (optional)`"
                class="min-h-[100px]"
              />
            </div>

            <!-- Regular input -->
            <div v-else class="relative">
              <Input
                :id="env.name"
                :type="getInputType(env)"
                :value="modelValue[env.name] || ''"
                @input="updateValue(env.name, ($event.target as HTMLInputElement).value)"
                :placeholder="env.placeholder || `Enter ${env.name} (optional)`"
              />

              <!-- Password toggle -->
              <Button
                v-if="env.type === 'password'"
                type="button"
                variant="ghost"
                size="sm"
                class="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                @click="togglePasswordVisibility(env.name)"
              >
                <Eye v-if="!showPasswords[env.name]" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </Button>
            </div>

            <!-- Validation message -->
            <p v-if="env.validation" class="text-xs text-gray-600">
              {{ env.validation }}
            </p>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
