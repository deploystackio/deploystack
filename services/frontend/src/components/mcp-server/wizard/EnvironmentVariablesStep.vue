<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import McpServerCard from '@/components/mcp-server/McpServerCard.vue'
import EnvironmentVariableCard from '@/components/mcp-server/EnvironmentVariableCard.vue'

// Props and model
const modelValue = defineModel<Record<string, string>>({ required: true })

interface Props {
  serverData?: any
}

const props = defineProps<Props>()

// Emits for validation state
const emit = defineEmits<{
  'validation-change': [isValid: boolean, missingFields: string[]]
}>()

const { t } = useI18n()

// Computed
const environmentVariables = computed(() => {
  if (!props.serverData?.environment_variables) return []
  return props.serverData.environment_variables
})


// Handle validation changes from the card component
const handleValidationChange = (isValid: boolean, missingFields: string[]) => {
  emit('validation-change', isValid, missingFields)
}

// Watch for server data changes to reset form
watch(() => props.serverData, (newData) => {
  if (newData?.environment_variables) {
    const newValues: Record<string, string> = {}
    newData.environment_variables.forEach((env: any) => {
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
    <!-- Step Header -->
    <div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        {{ t('mcpInstallations.wizard.environment.title') }}
      </h2>
      <p class="text-gray-600">
        {{ t('mcpInstallations.wizard.environment.description') }}
      </p>
    </div>

    <!-- Server Info -->
    <McpServerCard
      v-if="serverData"
      :server="serverData"
      :show-install-button="false"
      :show-details-button="false"
    />

    <!-- Environment Variables Card -->
    <EnvironmentVariableCard
      v-model="modelValue"
      :variables="environmentVariables"
      @validation-change="handleValidationChange"
    />
  </div>
</template>
