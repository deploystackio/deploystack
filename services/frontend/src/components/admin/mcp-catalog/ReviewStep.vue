<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
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

// Get Claude Desktop config from storage
const claudeConfig = ref<string>('')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parsedConfig = ref<any>(null)

onMounted(() => {
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
})


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
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium">{{ t('mcpCatalog.form.review.title') }}</h3>
      <p class="text-sm text-muted-foreground">{{ t('mcpCatalog.form.review.subtitle') }}</p>
    </div>

    <!-- Basic Information -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">{{ t('mcpCatalog.form.review.sections.basic') }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 class="font-medium text-sm text-muted-foreground">Server Name</h4>
            <p class="text-sm">{{ props.formData.basic.name || 'Not specified' }}</p>
          </div>
          <div>
            <h4 class="font-medium text-sm text-muted-foreground">Category</h4>
            <p class="text-sm">{{ props.formData.basic.category_id || 'Not specified' }}</p>
          </div>
          <div>
            <h4 class="font-medium text-sm text-muted-foreground">Featured Server</h4>
            <Badge v-if="props.formData.basic.featured" variant="default" class="text-xs">
              {{ t('mcpCatalog.edit.values.yes') }}
            </Badge>
            <span v-else class="text-sm text-muted-foreground">
              {{ t('mcpCatalog.edit.values.no') }}
            </span>
          </div>
        </div>

        <div>
          <h4 class="font-medium text-sm text-muted-foreground">Description</h4>
          <p class="text-sm">{{ props.formData.basic.description || 'Not specified' }}</p>
        </div>

        <div v-if="props.formData.basic.long_description">
          <h4 class="font-medium text-sm text-muted-foreground">Detailed Description</h4>
          <p class="text-sm">{{ props.formData.basic.long_description }}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 class="font-medium text-sm text-muted-foreground">Author</h4>
            <p class="text-sm">{{ props.formData.basic.author_name || 'Not specified' }}</p>
          </div>
          <div>
            <h4 class="font-medium text-sm text-muted-foreground">Contact</h4>
            <p class="text-sm">{{ props.formData.basic.author_contact || 'Not specified' }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 class="font-medium text-sm text-muted-foreground">Organization</h4>
            <p class="text-sm">{{ props.formData.basic.organization || 'Not specified' }}</p>
          </div>
          <div>
            <h4 class="font-medium text-sm text-muted-foreground">License</h4>
            <p class="text-sm">{{ props.formData.basic.license || 'Not specified' }}</p>
          </div>
        </div>

        <div v-if="props.formData.basic.tags.length > 0">
          <h4 class="font-medium text-sm text-muted-foreground">Tags</h4>
          <div class="flex flex-wrap gap-1 mt-1">
            <Badge v-for="tag in props.formData.basic.tags" :key="tag" variant="secondary" class="text-xs">
              {{ tag }}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Repository Information -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">{{ t('mcpCatalog.form.review.sections.repository') }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div>
          <h4 class="font-medium text-sm text-muted-foreground">GitHub Repository</h4>
          <p class="text-sm">{{ props.formData.repository.github_url || 'Not specified' }}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 class="font-medium text-sm text-muted-foreground">Git Branch</h4>
            <p class="text-sm">{{ props.formData.repository.git_branch || 'main' }}</p>
          </div>
          <div>
            <h4 class="font-medium text-sm text-muted-foreground">Homepage</h4>
            <p class="text-sm">{{ props.formData.repository.homepage_url || 'Not specified' }}</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Technical Specifications -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">{{ t('mcpCatalog.form.review.sections.technical') }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 class="font-medium text-sm text-muted-foreground">Language</h4>
            <p class="text-sm">{{ props.formData.technical.language || 'Not specified' }}</p>
          </div>
          <div>
            <h4 class="font-medium text-sm text-muted-foreground">Runtime</h4>
            <p class="text-sm">{{ props.formData.technical.runtime || 'Not specified' }}</p>
          </div>
          <div>
            <h4 class="font-medium text-sm text-muted-foreground">Min Version</h4>
            <p class="text-sm">{{ props.formData.technical.runtime_min_version || 'Not specified' }}</p>
          </div>
        </div>

        <div v-if="props.formData.technical.installation_methods.length > 0">
          <h4 class="font-medium text-sm text-muted-foreground">Installation Methods</h4>
          <div class="space-y-2 mt-2">
            <div
              v-for="(method, index) in props.formData.technical.installation_methods"
              :key="index"
              class="flex items-center gap-2 text-sm"
            >
              <Badge variant="outline" class="text-xs">{{ method.client || 'Unknown' }}</Badge>
              <code class="text-xs bg-muted px-2 py-1 rounded">{{ method.command }}</code>
              <span v-if="method.args && method.args.length > 0" class="text-xs text-muted-foreground">
                + {{ method.args.length }} arg{{ method.args.length > 1 ? 's' : '' }}
              </span>
              <span v-if="method.env && Object.keys(method.env).length > 0" class="text-xs text-muted-foreground">
                + {{ Object.keys(method.env).length }} env var{{ Object.keys(method.env).length > 1 ? 's' : '' }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="props.formData.technical.dependencies">
          <h4 class="font-medium text-sm text-muted-foreground">Dependencies</h4>
          <p class="text-sm">{{ props.formData.technical.dependencies }}</p>
        </div>
      </CardContent>
    </Card>

    <!-- Capabilities -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">{{ t('mcpCatalog.form.review.sections.capabilities') }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- Tools -->
        <div v-if="props.formData.capabilities.tools.length > 0">
          <h4 class="font-medium text-sm text-muted-foreground">Tools ({{ props.formData.capabilities.tools.length }})</h4>
          <div class="space-y-2 mt-2">
            <div
              v-for="(tool, index) in props.formData.capabilities.tools"
              :key="index"
              class="text-sm"
            >
              <span class="font-medium">{{ tool.name }}</span>
              <span v-if="tool.description" class="text-muted-foreground"> - {{ tool.description }}</span>
            </div>
          </div>
        </div>

        <!-- Resources -->
        <div v-if="props.formData.capabilities.resources.length > 0">
          <h4 class="font-medium text-sm text-muted-foreground">Resources ({{ props.formData.capabilities.resources.length }})</h4>
          <div class="space-y-2 mt-2">
            <div
              v-for="(resource, index) in props.formData.capabilities.resources"
              :key="index"
              class="text-sm"
            >
              <span class="font-medium">{{ resource.type }}</span>
              <span v-if="resource.description" class="text-muted-foreground"> - {{ resource.description }}</span>
            </div>
          </div>
        </div>

        <!-- Prompts -->
        <div v-if="props.formData.capabilities.prompts.length > 0">
          <h4 class="font-medium text-sm text-muted-foreground">Prompts ({{ props.formData.capabilities.prompts.length }})</h4>
          <div class="space-y-2 mt-2">
            <div
              v-for="(prompt, index) in props.formData.capabilities.prompts"
              :key="index"
              class="text-sm"
            >
              <span class="font-medium">{{ prompt.name }}</span>
              <span v-if="prompt.description" class="text-muted-foreground"> - {{ prompt.description }}</span>
            </div>
          </div>
        </div>

        <!-- Environment Variables -->
        <div v-if="props.formData.capabilities.environment_variables.length > 0">
          <h4 class="font-medium text-sm text-muted-foreground">Environment Variables ({{ props.formData.capabilities.environment_variables.length }})</h4>
          <div class="space-y-2 mt-2">
            <div
              v-for="(envVar, index) in props.formData.capabilities.environment_variables"
              :key="index"
              class="flex items-center gap-2 text-sm"
            >
              <code class="text-xs bg-muted px-2 py-1 rounded">{{ envVar.name }}</code>
              <Badge v-if="envVar.required" variant="destructive" class="text-xs">Required</Badge>
              <Badge v-else variant="secondary" class="text-xs">Optional</Badge>
              <span v-if="envVar.description" class="text-muted-foreground">{{ envVar.description }}</span>
            </div>
          </div>
        </div>

        <!-- Default Configuration -->
        <div v-if="props.formData.capabilities.default_config">
          <h4 class="font-medium text-sm text-muted-foreground">Default Configuration</h4>
          <pre class="text-xs bg-muted p-3 rounded mt-2 overflow-x-auto">{{ formatJson(props.formData.capabilities.default_config) }}</pre>
        </div>
      </CardContent>
    </Card>

  </div>
</template>
