<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-vue-next'
import type {
  TechnicalFormData,
  InstallationMethod,
  LANGUAGE_OPTIONS,
  RUNTIME_OPTIONS,
  INSTALLATION_TYPE_OPTIONS
} from '@/views/admin/mcp-server-catalog/types'

interface Props {
  modelValue: TechnicalFormData
  formData: any
}

interface Emits {
  (e: 'update:modelValue', value: TechnicalFormData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// Import options from types
const languageOptions = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'other', label: 'Other' }
]

const runtimeOptions = [
  { value: 'node', label: 'Node.js' },
  { value: 'python', label: 'Python' },
  { value: 'docker', label: 'Docker' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'dotnet', label: '.NET' },
  { value: 'other', label: 'Other' }
]

const installationTypeOptions = [
  { value: 'npm', label: 'npm' },
  { value: 'pip', label: 'pip' },
  { value: 'docker', label: 'Docker' },
  { value: 'git', label: 'Git Clone' },
  { value: 'binary', label: 'Binary Download' },
  { value: 'other', label: 'Other' }
]

// Computed model
const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Installation methods management
const addInstallationMethod = () => {
  localValue.value = {
    ...localValue.value,
    installation_methods: [
      ...localValue.value.installation_methods,
      { type: 'npm', command: '' }
    ]
  }
}

const removeInstallationMethod = (index: number) => {
  localValue.value = {
    ...localValue.value,
    installation_methods: localValue.value.installation_methods.filter((_, i) => i !== index)
  }
}

const updateInstallationMethod = (index: number, field: keyof InstallationMethod, value: string) => {
  const methods = [...localValue.value.installation_methods]
  methods[index] = { ...methods[index], [field]: value }
  localValue.value = {
    ...localValue.value,
    installation_methods: methods
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium">{{ t('mcpCatalog.form.technical.title') }}</h3>
      <p class="text-sm text-muted-foreground">{{ t('mcpCatalog.form.technical.subtitle') }}</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Programming Language -->
      <div class="space-y-2">
        <Label for="language">{{ t('mcpCatalog.form.technical.language.label') }}</Label>
        <Select v-model="localValue.language">
          <SelectTrigger>
            <SelectValue :placeholder="t('mcpCatalog.form.technical.language.placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in languageOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">
          {{ t('mcpCatalog.form.technical.language.description') }}
        </p>
      </div>

      <!-- Runtime Environment -->
      <div class="space-y-2">
        <Label for="runtime">{{ t('mcpCatalog.form.technical.runtime.label') }}</Label>
        <Select v-model="localValue.runtime">
          <SelectTrigger>
            <SelectValue :placeholder="t('mcpCatalog.form.technical.runtime.placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in runtimeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">
          {{ t('mcpCatalog.form.technical.runtime.description') }}
        </p>
      </div>
    </div>

    <!-- Minimum Runtime Version -->
    <div class="space-y-2">
      <Label for="runtime_min_version">{{ t('mcpCatalog.form.technical.minVersion.label') }}</Label>
      <Input
        id="runtime_min_version"
        v-model="localValue.runtime_min_version"
        :placeholder="t('mcpCatalog.form.technical.minVersion.placeholder')"
      />
      <p class="text-xs text-muted-foreground">
        {{ t('mcpCatalog.form.technical.minVersion.description') }}
      </p>
    </div>

    <!-- Installation Methods -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <Label>{{ t('mcpCatalog.form.technical.installationMethods.label') }}</Label>
          <p class="text-xs text-muted-foreground">
            {{ t('mcpCatalog.form.technical.installationMethods.description') }}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          @click="addInstallationMethod"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('mcpCatalog.form.technical.installationMethods.addMethod') }}
        </Button>
      </div>

      <div v-if="localValue.installation_methods.length === 0" class="text-center py-8 text-muted-foreground">
        No installation methods added yet. Click "Add Installation Method" to get started.
      </div>

      <div v-else class="space-y-4">
        <Card
          v-for="(method, index) in localValue.installation_methods"
          :key="index"
          class="relative"
        >
          <CardHeader class="pb-3">
            <div class="flex items-center justify-between">
              <CardTitle class="text-sm">Installation Method {{ index + 1 }}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                @click="removeInstallationMethod(index)"
                class="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Installation Type -->
              <div class="space-y-2">
                <Label>{{ t('mcpCatalog.form.technical.installationMethods.type.label') }}</Label>
                <Select
                  :model-value="method.type"
                  @update:model-value="(value) => updateInstallationMethod(index, 'type', value as string)"
                >
                  <SelectTrigger>
                    <SelectValue :placeholder="t('mcpCatalog.form.technical.installationMethods.type.placeholder')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in installationTypeOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Command -->
              <div class="space-y-2">
                <Label>{{ t('mcpCatalog.form.technical.installationMethods.command.label') }}</Label>
                <Input
                  :model-value="method.command"
                  @update:model-value="(value) => updateInstallationMethod(index, 'command', String(value))"
                  :placeholder="t('mcpCatalog.form.technical.installationMethods.command.placeholder')"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Dependencies -->
    <div class="space-y-2">
      <Label for="dependencies">{{ t('mcpCatalog.form.technical.dependencies.label') }}</Label>
      <Textarea
        id="dependencies"
        v-model="localValue.dependencies"
        :placeholder="t('mcpCatalog.form.technical.dependencies.placeholder')"
        rows="4"
      />
      <p class="text-xs text-muted-foreground">
        {{ t('mcpCatalog.form.technical.dependencies.description') }}
      </p>
    </div>
  </div>
</template>
