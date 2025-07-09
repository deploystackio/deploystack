<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2 } from 'lucide-vue-next'
import type {
  CapabilitiesFormData,
  McpTool,
  McpResource,
  McpPrompt,
  EnvironmentVariable
} from '@/views/admin/mcp-server-catalog/types'

interface Props {
  modelValue: CapabilitiesFormData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any
}

interface Emits {
  (e: 'update:modelValue', value: CapabilitiesFormData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// Computed model
const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Tools management
const addTool = () => {
  localValue.value = {
    ...localValue.value,
    tools: [...localValue.value.tools, { name: '', description: '' }]
  }
}

const removeTool = (index: number) => {
  localValue.value = {
    ...localValue.value,
    tools: localValue.value.tools.filter((_, i) => i !== index)
  }
}

const updateTool = (index: number, field: keyof McpTool, value: string) => {
  const tools = [...localValue.value.tools]
  tools[index] = { ...tools[index], [field]: value }
  localValue.value = {
    ...localValue.value,
    tools
  }
}

// Resources management
const addResource = () => {
  localValue.value = {
    ...localValue.value,
    resources: [...localValue.value.resources, { type: '', description: '' }]
  }
}

const removeResource = (index: number) => {
  localValue.value = {
    ...localValue.value,
    resources: localValue.value.resources.filter((_, i) => i !== index)
  }
}

const updateResource = (index: number, field: keyof McpResource, value: string) => {
  const resources = [...localValue.value.resources]
  resources[index] = { ...resources[index], [field]: value }
  localValue.value = {
    ...localValue.value,
    resources
  }
}

// Prompts management
const addPrompt = () => {
  localValue.value = {
    ...localValue.value,
    prompts: [...localValue.value.prompts, { name: '', description: '' }]
  }
}

const removePrompt = (index: number) => {
  localValue.value = {
    ...localValue.value,
    prompts: localValue.value.prompts.filter((_, i) => i !== index)
  }
}

const updatePrompt = (index: number, field: keyof McpPrompt, value: string) => {
  const prompts = [...localValue.value.prompts]
  prompts[index] = { ...prompts[index], [field]: value }
  localValue.value = {
    ...localValue.value,
    prompts
  }
}

// Environment Variables management
const addEnvironmentVariable = () => {
  localValue.value = {
    ...localValue.value,
    environment_variables: [
      ...localValue.value.environment_variables,
      { name: '', description: '', required: false }
    ]
  }
}

const removeEnvironmentVariable = (index: number) => {
  localValue.value = {
    ...localValue.value,
    environment_variables: localValue.value.environment_variables.filter((_, i) => i !== index)
  }
}

const updateEnvironmentVariable = (index: number, field: keyof EnvironmentVariable, value: string | boolean) => {
  const envVars = [...localValue.value.environment_variables]
  envVars[index] = { ...envVars[index], [field]: value }
  localValue.value = {
    ...localValue.value,
    environment_variables: envVars
  }
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h3 class="text-lg font-medium">{{ t('mcpCatalog.form.capabilities.title') }}</h3>
      <p class="text-sm text-muted-foreground">{{ t('mcpCatalog.form.capabilities.subtitle') }}</p>
    </div>

    <!-- Tools Section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <Label class="text-base font-medium">{{ t('mcpCatalog.form.capabilities.tools.label') }}</Label>
          <p class="text-xs text-muted-foreground">
            {{ t('mcpCatalog.form.capabilities.tools.description') }}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          @click="addTool"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('mcpCatalog.form.capabilities.tools.addTool') }}
        </Button>
      </div>

      <div v-if="localValue.tools.length === 0" class="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
        No tools defined yet. Click "Add Tool" to get started.
      </div>

      <div v-else class="space-y-3">
        <Card
          v-for="(tool, index) in localValue.tools"
          :key="index"
          class="relative"
        >
          <CardHeader class="pb-3">
            <div class="flex items-center justify-between">
              <CardTitle class="text-sm">Tool {{ index + 1 }}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                @click="removeTool(index)"
                class="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>{{ t('mcpCatalog.form.capabilities.tools.name.label') }}</Label>
                <Input
                  :model-value="tool.name"
                  @update:model-value="(value) => updateTool(index, 'name', String(value))"
                  :placeholder="t('mcpCatalog.form.capabilities.tools.name.placeholder')"
                />
              </div>
              <div class="space-y-2">
                <Label>{{ t('mcpCatalog.form.capabilities.tools.toolDescription.label') }}</Label>
                <Input
                  :model-value="tool.description"
                  @update:model-value="(value) => updateTool(index, 'description', String(value))"
                  :placeholder="t('mcpCatalog.form.capabilities.tools.toolDescription.placeholder')"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Resources Section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <Label class="text-base font-medium">{{ t('mcpCatalog.form.capabilities.resources.label') }}</Label>
          <p class="text-xs text-muted-foreground">
            {{ t('mcpCatalog.form.capabilities.resources.description') }}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          @click="addResource"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('mcpCatalog.form.capabilities.resources.addResource') }}
        </Button>
      </div>

      <div v-if="localValue.resources.length === 0" class="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
        No resources defined yet. Click "Add Resource" to get started.
      </div>

      <div v-else class="space-y-3">
        <Card
          v-for="(resource, index) in localValue.resources"
          :key="index"
          class="relative"
        >
          <CardHeader class="pb-3">
            <div class="flex items-center justify-between">
              <CardTitle class="text-sm">Resource {{ index + 1 }}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                @click="removeResource(index)"
                class="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>{{ t('mcpCatalog.form.capabilities.resources.type.label') }}</Label>
                <Input
                  :model-value="resource.type"
                  @update:model-value="(value) => updateResource(index, 'type', String(value))"
                  :placeholder="t('mcpCatalog.form.capabilities.resources.type.placeholder')"
                />
              </div>
              <div class="space-y-2">
                <Label>{{ t('mcpCatalog.form.capabilities.resources.resourceDescription.label') }}</Label>
                <Input
                  :model-value="resource.description"
                  @update:model-value="(value) => updateResource(index, 'description', String(value))"
                  :placeholder="t('mcpCatalog.form.capabilities.resources.resourceDescription.placeholder')"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Prompts Section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <Label class="text-base font-medium">{{ t('mcpCatalog.form.capabilities.prompts.label') }}</Label>
          <p class="text-xs text-muted-foreground">
            {{ t('mcpCatalog.form.capabilities.prompts.description') }}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          @click="addPrompt"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('mcpCatalog.form.capabilities.prompts.addPrompt') }}
        </Button>
      </div>

      <div v-if="localValue.prompts.length === 0" class="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
        No prompts defined yet. Click "Add Prompt" to get started.
      </div>

      <div v-else class="space-y-3">
        <Card
          v-for="(prompt, index) in localValue.prompts"
          :key="index"
          class="relative"
        >
          <CardHeader class="pb-3">
            <div class="flex items-center justify-between">
              <CardTitle class="text-sm">Prompt {{ index + 1 }}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                @click="removePrompt(index)"
                class="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>{{ t('mcpCatalog.form.capabilities.prompts.name.label') }}</Label>
                <Input
                  :model-value="prompt.name"
                  @update:model-value="(value) => updatePrompt(index, 'name', String(value))"
                  :placeholder="t('mcpCatalog.form.capabilities.prompts.name.placeholder')"
                />
              </div>
              <div class="space-y-2">
                <Label>{{ t('mcpCatalog.form.capabilities.prompts.promptDescription.label') }}</Label>
                <Input
                  :model-value="prompt.description"
                  @update:model-value="(value) => updatePrompt(index, 'description', String(value))"
                  :placeholder="t('mcpCatalog.form.capabilities.prompts.promptDescription.placeholder')"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Environment Variables Section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <Label class="text-base font-medium">{{ t('mcpCatalog.form.capabilities.environmentVariables.label') }}</Label>
          <p class="text-xs text-muted-foreground">
            {{ t('mcpCatalog.form.capabilities.environmentVariables.description') }}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          @click="addEnvironmentVariable"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('mcpCatalog.form.capabilities.environmentVariables.addVariable') }}
        </Button>
      </div>

      <div v-if="localValue.environment_variables.length === 0" class="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
        No environment variables defined yet. Click "Add Variable" to get started.
      </div>

      <div v-else class="space-y-3">
        <Card
          v-for="(envVar, index) in localValue.environment_variables"
          :key="index"
          class="relative"
        >
          <CardHeader class="pb-3">
            <div class="flex items-center justify-between">
              <CardTitle class="text-sm">Environment Variable {{ index + 1 }}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                @click="removeEnvironmentVariable(index)"
                class="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="space-y-2">
                <Label>{{ t('mcpCatalog.form.capabilities.environmentVariables.name.label') }}</Label>
                <Input
                  :model-value="envVar.name"
                  @update:model-value="(value) => updateEnvironmentVariable(index, 'name', String(value))"
                  :placeholder="t('mcpCatalog.form.capabilities.environmentVariables.name.placeholder')"
                />
              </div>
              <div class="space-y-2">
                <Label>{{ t('mcpCatalog.form.capabilities.environmentVariables.variableDescription.label') }}</Label>
                <Input
                  :model-value="envVar.description"
                  @update:model-value="(value) => updateEnvironmentVariable(index, 'description', String(value))"
                  :placeholder="t('mcpCatalog.form.capabilities.environmentVariables.variableDescription.placeholder')"
                />
              </div>
              <div class="space-y-2">
                <Label>{{ t('mcpCatalog.form.capabilities.environmentVariables.required.label') }}</Label>
                <div class="flex items-center space-x-2 pt-2">
                  <Switch
                    :checked="envVar.required"
                    @update:checked="(value: boolean) => updateEnvironmentVariable(index, 'required', value)"
                  />
                  <span class="text-sm">{{ t('mcpCatalog.form.capabilities.environmentVariables.required.description') }}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Default Configuration -->
    <div class="space-y-2">
      <Label for="default_config">{{ t('mcpCatalog.form.capabilities.defaultConfig.label') }}</Label>
      <Textarea
        id="default_config"
        v-model="localValue.default_config"
        :placeholder="t('mcpCatalog.form.capabilities.defaultConfig.placeholder')"
        rows="6"
      />
      <p class="text-xs text-muted-foreground">
        {{ t('mcpCatalog.form.capabilities.defaultConfig.description') }}
      </p>
    </div>
  </div>
</template>
