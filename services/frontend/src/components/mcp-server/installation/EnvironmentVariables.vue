<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings } from 'lucide-vue-next'
import type { McpInstallation } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
}

const props = defineProps<Props>()
const { t } = useI18n()

// Installation-specific computed properties
const displayUserEnvironmentVariables = computed(() => {
  return props.installation?.user_environment_variables || {}
})

const hasEnvironmentVariables = computed(() => {
  return Object.keys(displayUserEnvironmentVariables.value).length > 0
})
</script>

<template>
  <div>
    <div class="px-4 sm:px-0">
      <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpInstallations.details.environmentVariables.title') }}</h3>
      <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('mcpInstallations.details.environmentVariables.description') }}</p>
    </div>

    <div class="mt-6 border-t border-gray-100">
      <!-- Environment Variables Content -->
      <div v-if="hasEnvironmentVariables" class="px-4 py-6 sm:px-0">
        <div class="bg-gray-50 rounded-md p-4">
          <div class="space-y-3">
            <div
              v-for="(value, key) in displayUserEnvironmentVariables"
              :key="key"
              class="flex items-center gap-3 text-sm"
            >
              <div class="flex-shrink-0">
                <Settings class="h-4 w-4 text-gray-400" />
              </div>
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <code class="bg-green-50 text-green-700 px-2 py-1 rounded font-mono text-xs font-semibold">
                  {{ key }}
                </code>
                <span class="text-gray-400 flex-shrink-0">=</span>
                <code class="bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono text-xs break-all">
                  {{ value }}
                </code>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Additional Info -->
        <div class="mt-4 text-sm text-gray-500">
          <p class="flex items-center gap-2">
            <Settings class="h-4 w-4" />
            {{ t('mcpInstallations.details.environmentVariables.info') }}
          </p>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="px-4 py-12 sm:px-0 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
          <Settings class="h-6 w-6 text-gray-400" />
        </div>
        <h3 class="text-sm font-medium text-gray-900 mb-2">{{ t('mcpInstallations.details.environmentVariables.noVariables.title') }}</h3>
        <p class="text-sm text-gray-500 max-w-sm mx-auto">
          {{ t('mcpInstallations.details.environmentVariables.noVariables.description') }}
        </p>
      </div>
    </div>
  </div>
</template>
