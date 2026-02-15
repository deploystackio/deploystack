<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
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

// Configuration Schema types
interface ConfigurationSchema {
  template_args?: { value: string; locked: boolean; description?: string; order?: number }[]
  team_args_schema?: { name: string; type: string; description?: string; required: boolean; locked: boolean; order?: number }[]
  user_args_schema?: { name: string; type: string; description?: string; required: boolean; locked: boolean; order?: number }[]
  team_env_schema?: { name: string; type: string; description?: string; required: boolean; locked: boolean; visible_to_users?: boolean }[]
  user_env_schema?: { name: string; type: string; description?: string; required: boolean; locked: boolean }[]
  template_headers?: { name: string; value: string; locked: boolean; description?: string }[]
  team_headers_schema?: { name: string; type: string; description?: string; required: boolean; locked: boolean; visible_to_users?: boolean }[]
  user_headers_schema?: { name: string; type: string; description?: string; required: boolean; locked: boolean }[]
  template_url_query_params?: { name: string; value: string; locked: boolean; description?: string }[]
  team_url_query_params_schema?: { name: string; type: string; description?: string; required: boolean; locked: boolean; visible_to_users?: boolean }[]
  user_url_query_params_schema?: { name: string; type: string; description?: string; required: boolean; locked: boolean }[]
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
const freshRepositorySetupData = ref<any>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const freshTechnicalData = ref<any>(null)
 
const freshConfigurationSchema = ref<ConfigurationSchema | null>(null)

const claudeConfig = ref<string>('')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parsedConfig = ref<any>(null)

// Check if transport type is HTTP-based (no STDIO config needed)
const isHttpTransport = computed(() => {
  const technicalData = freshTechnicalData.value || props.formData.technical
  if (!technicalData) return false
  const transportType = technicalData.transport_type
  return transportType === 'http' || transportType === 'sse' || transportType === 'streamableHttp'
})

// Build Claude Desktop config from configuration schema (same logic as ConfigurationSchemaStepEdit)
const assembledClaudeConfig = computed(() => {
  // For HTTP servers, no args preview needed
  if (isHttpTransport.value) return null

  const technicalData = freshTechnicalData.value || props.formData.technical
  const basicData = freshBasicData.value || props.formData.basic
  const schema = freshConfigurationSchema.value || props.formData.configuration_schema

  if (!technicalData || !schema) return null

  // Build args array from configuration schema
  // Collect all arguments with their order
  const allArgs: { value: string; order: number }[] = []

  // Template args (static values)
  if (schema.template_args && Array.isArray(schema.template_args)) {
    schema.template_args.forEach((arg, index) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allArgs.push({ value: arg.value, order: (arg as any).order ?? index })
    })
  }

  // Team args (show placeholder)
  if (schema.team_args_schema && Array.isArray(schema.team_args_schema)) {
    schema.team_args_schema.forEach((arg, index) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allArgs.push({ value: arg.name, order: (arg as any).order ?? (100 + index) })
    })
  }

  // User args (show placeholder)
  if (schema.user_args_schema && Array.isArray(schema.user_args_schema)) {
    schema.user_args_schema.forEach((arg, index) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allArgs.push({ value: arg.name, order: (arg as any).order ?? (200 + index) })
    })
  }

  // Sort by order
  allArgs.sort((a, b) => a.order - b.order)
  const currentArgs = allArgs.map(arg => arg.value)

  // Get server name and command from technical data
  const serverName = basicData?.name || technicalData.name || 'server'
  const packages = technicalData.packages || []
  const command = packages[0]?.transport?.command || packages[0]?.name || 'npx'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    mcpServers: {
      [serverName]: {
        command: command
      }
    }
  }

  if (currentArgs.length > 0) {
    config.mcpServers[serverName].args = currentArgs
  }

  // Add env from configuration schema
  const envItems: { name: string; value?: string }[] = []

  // Team env schema
  if (schema.team_env_schema && Array.isArray(schema.team_env_schema)) {
    schema.team_env_schema.forEach(env => {
      envItems.push({ name: env.name })
    })
  }

  // User env schema
  if (schema.user_env_schema && Array.isArray(schema.user_env_schema)) {
    schema.user_env_schema.forEach(env => {
      envItems.push({ name: env.name })
    })
  }

  if (envItems.length > 0) {
    config.mcpServers[serverName].env = {}
    envItems.forEach(item => {
      config.mcpServers[serverName].env[item.name] = `<${item.name}>`
    })
  }

  try {
    return JSON.stringify(config, null, 2)
  } catch {
    return null
  }
})

// Function to load fresh data from storage
const loadFreshData = () => {
  // Get fresh data from storage for all form sections
  freshBasicData.value = eventBus.getState('edit_basic_data')
  freshRepositoryData.value = eventBus.getState('edit_repository_data')
  freshRepositorySetupData.value = eventBus.getState('edit_repository_setup_data')
  freshTechnicalData.value = eventBus.getState('edit_technical_data')
  freshConfigurationSchema.value = eventBus.getState<ConfigurationSchema>('edit_configuration_schema')

  // Use assembled config from configuration schema, fall back to stored edit_claude_config
  const assembled = assembledClaudeConfig.value
  if (assembled) {
    claudeConfig.value = assembled
  } else {
    // Fallback to original stored config
    const storedConfig = eventBus.getState<string>('edit_claude_config', '') || ''
    claudeConfig.value = storedConfig
  }

  // Parse it for display
  try {
    if (claudeConfig.value) {
      parsedConfig.value = JSON.parse(claudeConfig.value)
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
      data.key === 'edit_repository_setup_data' ||
      data.key === 'edit_technical_data' ||
      data.key === 'edit_claude_config' ||
      data.key === 'edit_configuration_schema') {
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
const getRepositoryData = () => {
  // Merge repository data and repository setup data
  // Repository setup data (from RepositoryStep) takes priority for git_branch, repository_url, etc.
  const repoData = freshRepositoryData.value || props.formData.repository
  const setupData = freshRepositorySetupData.value || {}

  return {
    ...repoData,
    // Override with setup data if available (this is what user edited in RepositoryStep)
    repository_url: setupData.repository_url !== undefined ? setupData.repository_url : repoData.repository_url,
    repository_source: setupData.repository_source !== undefined ? setupData.repository_source : repoData.repository_source,
    git_branch: setupData.git_branch !== undefined ? setupData.git_branch : repoData.git_branch
  }
}
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

      <div v-if="getBasicData().slug" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.slug') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <span class="font-mono text-xs">{{ getBasicData().slug }}</span>
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
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.skipOAuthFlow.label') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <Badge v-if="getBasicData().skip_oauth_flow" variant="default" class="text-xs bg-amber-50 text-amber-700 border-amber-200">
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

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.review.fields.homepage') }}</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getBasicData().website_url || t('mcpCatalog.form.review.values.notSpecified') }}
        </dd>
      </div>

      <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt class="text-sm/6 font-medium text-gray-900">Icon URL</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          {{ getBasicData().icon_url || t('mcpCatalog.form.review.values.notSpecified') }}
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
          {{ getRepositoryData().git_branch || t('mcpCatalog.form.review.values.notSpecified') }}
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
