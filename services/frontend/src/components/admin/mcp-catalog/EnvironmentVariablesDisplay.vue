<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Badge } from '@/components/ui/badge'
import { Settings } from 'lucide-vue-next'
import type { EnvironmentVariable } from '@/views/admin/mcp-server-catalog/types'

const { t } = useI18n()

interface Props {
  environmentVariables?: EnvironmentVariable[] | null
  mode?: 'view' | 'edit'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'view'
})

const displayEnvironmentVariables = computed(() => {
  if (!props.environmentVariables) return null
  // Handle both object and JSON string formats
  if (typeof props.environmentVariables === 'object') {
    return props.environmentVariables
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(props.environmentVariables as any)
  } catch {
    return null
  }
})

const hasEnvironmentVariables = computed(() => {
  return displayEnvironmentVariables.value && Array.isArray(displayEnvironmentVariables.value) && displayEnvironmentVariables.value.length > 0
})
</script>

<template>
  <div>
    <div v-if="hasEnvironmentVariables">
      <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
        <li
          v-for="(variable, index) in displayEnvironmentVariables"
          :key="index"
          class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
        >
          <div class="flex w-0 flex-1 items-center">
            <Settings class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
            <div class="ml-4 flex min-w-0 flex-1 gap-2">
              <div class="flex flex-col">
                <span class="truncate font-medium font-mono">{{ variable.name }}</span>
                <span v-if="variable.description" class="truncate text-xs text-gray-500">{{ variable.description }}</span>
                <div class="flex gap-2 mt-1">
                  <Badge v-if="variable.required" variant="destructive" class="text-xs">{{ t('mcpCatalog.form.capabilities.environmentVariables.requiredBadge') }}</Badge>
                  <Badge v-if="variable.type" variant="outline" class="text-xs">{{ variable.type }}</Badge>
                </div>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>
    <div v-else class="text-sm text-gray-500 italic">
      {{ t('mcpCatalog.form.capabilities.environmentVariables.noVariables') }}
    </div>
  </div>
</template>
