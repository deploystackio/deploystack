<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
import CategoryDisplay from '@/components/mcp-server/CategoryDisplay.vue'
import type { ReviewFormData, McpServerFormData } from '@/views/admin/mcp-server-catalog/types'

interface Props {
  modelValue: ReviewFormData
  formData: McpServerFormData
}

interface Emits {
  (e: 'update:modelValue', value: ReviewFormData): void
}

const props = defineProps<Props>()
defineEmits<Emits>()
const { t } = useI18n()
const eventBus = useEventBus()

// Fresh data from storage - reactive refs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const freshBasicData = ref<any>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const freshRepositoryData = ref<any>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const freshTechnicalData = ref<any>(null)

const claudeConfig = ref<string>('')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parsedConfig = ref<any>(null)

// Function to load fresh data from storage
const loadFreshData = () => {
  // Get fresh data from storage for all form sections
  freshBasicData.value = eventBus.getState('edit_basic_data')
  freshRepositoryData.value = eventBus.getState('edit_repository_data')
  freshTechnicalData.value = eventBus.getState('edit_technical_data')

  // Get the stored Claude Desktop config
  const storedConfig = eventBus.getState<string>('edit_claude_config', '') || ''
  claudeConfig.value = storedConfig

  // Parse it for display
  try {
    if (storedConfig) {
      parsedConfig.value = JSON.parse(storedConfig)
    }
  } catch {
    // Invalid JSON, will show raw text
  }
}

// Storage change handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleStorageChange = (data: { key: string; oldValue: any; newValue: any }) => {
  // Reload data when any of our storage keys change
  if (data.key === 'edit_basic_data' ||
      data.key === 'edit_repository_data' ||
      data.key === 'edit_technical_data' ||
      data.key === 'edit_claude_config') {
    loadFreshData()
  }
}

onMounted(() => {
  // Load initial data
  loadFreshData()

  // Listen for storage changes
  eventBus.on('storage-changed', handleStorageChange)
})

onUnmounted(() => {
  // Clean up event listeners
  eventBus.off('storage-changed', handleStorageChange)
})

// Helper functions to get fresh data with fallback to props
const getBasicData = () => freshBasicData.value || props.formData.basic
const getRepositoryData = () => freshRepositoryData.value || props.formData.repository
const getTechnicalData = () => freshTechnicalData.value || props.formData.technical


const formatJson = (jsonString: string) => {
  if (!jsonString) return 'None'
  try {
    return JSON.stringify(JSON.parse(jsonString), null, 2)
  } catch {
    return jsonString
  }
}
</script>

<template>
  <!-- Basic Information Section -->
  <div class="px-4 sm:px-0">
    <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpCatalog.form.review.sections.basic') }}</h3>
    <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('mcpCatalog.form.review.descriptions.basic') }}</p>
  </div>

  <div class="mt-6 border-t border-gray-100">
    <dl class="divide-y divide-gray-100">
      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.serverName') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getBasicData().name || t('mcpCatalog.form.review.values.notSpecified') }}
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.description') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getBasicData().description || t('mcpCatalog.form.review.values.notSpecified') }}
        </dd>
      </div>

      <div v-if="getBasicData().long_description" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.detailedDescription') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getBasicData().long_description }}
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.category') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <CategoryDisplay :category-id="getBasicData().category_id" />
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.featuredServer') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <Badge v-if="getBasicData().featured" variant="default" class="text-xs">
            {{ t('mcpCatalog.edit.values.yes') }}
          </Badge>
          <span v-else class="text-sm text-muted-foreground">
            {{ t('mcpCatalog.edit.values.no') }}
          </span>
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.autoInstall') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <Badge v-if="getBasicData().auto_install_new_default_team" variant="default" class="text-xs">
            {{ t('mcpCatalog.edit.values.yes') }}
          </Badge>
          <span v-else class="text-sm text-muted-foreground">
            {{ t('mcpCatalog.edit.values.no') }}
          </span>
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.author') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getBasicData().author_name || t('mcpCatalog.form.review.values.notSpecified') }}
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.contact') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getBasicData().author_contact || t('mcpCatalog.form.review.values.notSpecified') }}
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.organization') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getBasicData().organization || t('mcpCatalog.form.review.values.notSpecified') }}
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.license') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getBasicData().license || t('mcpCatalog.form.review.values.notSpecified') }}
        </dd>
      </div>

      <div v-if="getBasicData().tags && getBasicData().tags.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.tags') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <div class="flex flex-wrap gap-1">
            <Badge v-for="tag in getBasicData().tags" :key="tag" variant="secondary" class="text-xs">
              {{ tag }}
            </Badge>
          </div>
        </dd>
      </div>
    </dl>
  </div>

  <!-- Repository Section -->
  <div class="px-4 sm:px-0 mt-8">
    <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpCatalog.form.review.sections.repository') }}</h3>
    <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('mcpCatalog.form.review.descriptions.repository') }}</p>
  </div>

  <div class="mt-6 border-t border-gray-100">
    <dl class="divide-y divide-gray-100">
      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.githubRepository') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getRepositoryData().repository_url || t('mcpCatalog.form.review.values.notSpecified') }}
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.gitBranch') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getRepositoryData().git_branch || 'main' }}
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.homepage') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getRepositoryData().website_url || t('mcpCatalog.form.review.values.notSpecified') }}
        </dd>
      </div>
    </dl>
  </div>

  <!-- Technical Section -->
  <div class="px-4 sm:px-0 mt-8">
    <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpCatalog.form.review.sections.technical') }}</h3>
    <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('mcpCatalog.form.review.descriptions.technical') }}</p>
  </div>

  <div class="mt-6 border-t border-gray-100">
    <dl class="divide-y divide-gray-100">
      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.language') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getTechnicalData().language || t('mcpCatalog.form.review.values.notSpecified') }}
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.runtime') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getTechnicalData().runtime || t('mcpCatalog.form.review.values.notSpecified') }}
        </dd>
      </div>


      <div v-if="claudeConfig || (getTechnicalData().installation_methods && getTechnicalData().installation_methods.length > 0)" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.claudeDesktopConfiguration') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto">{{ claudeConfig || formatJson(JSON.stringify(getTechnicalData().installation_methods)) }}</pre>
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.transportType') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <Badge variant="outline" class="font-mono">
            {{ getTechnicalData().transport_type || 'auto' }}
          </Badge>
        </dd>
      </div>

      <div v-if="getTechnicalData().dependencies" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.dependencies') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getTechnicalData().dependencies }}
        </dd>
      </div>
    </dl>
  </div>


</template>
