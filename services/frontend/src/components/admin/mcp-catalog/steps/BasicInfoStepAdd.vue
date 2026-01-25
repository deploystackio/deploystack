<!--
 * ADD MODE BASIC INFO STEP
 *
 * This component follows the ADD wizard architecture:
 * - Uses v-model and props exclusively
 * - No storage or event bus for data management
 * - Pure Vue reactivity patterns
 * - Receives data through props, emits changes via update:modelValue
 -->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { X, Plus, CheckCircle } from 'lucide-vue-next'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import type { BasicInfoFormData } from '@/views/admin/mcp-server-catalog/types'
import { LANGUAGE_OPTIONS, RUNTIME_OPTIONS } from '@/views/admin/mcp-server-catalog/types'
import { useCategories } from '@/composables/admin/mcp-catalog/useCategories'
import { useTagManager } from '@/composables/admin/mcp-catalog/useTagManager'
import SharedFormField from '../shared/SharedFormField.vue'

interface Props {
  modelValue: BasicInfoFormData
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  formData?: any
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: BasicInfoFormData]
}>()

const { t } = useI18n()

// Use composables
const { categories, categoriesLoading, loadCategories } = useCategories()
const {
  newTag,
  addTag,
  removeTag,
  handleTagKeydown
} = useTagManager(
  () => localData.value.tags,
  (tags) => updateField('tags', tags)
)

// Local reactive data using v-model pattern
const localData = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Check if data was auto-populated from GitHub
const isAutoPopulated = computed(() => {
  return props.formData?.github?.auto_populated || false
})

// Get selected category for displaying icon in trigger
const selectedCategory = computed(() => {
  return categories.value.find(c => c.id === localData.value.category_id)
})

// Update field helper
const updateField = <K extends keyof BasicInfoFormData>(field: K, value: BasicInfoFormData[K]) => {
  const newData = {
    ...localData.value,
    [field]: value
  }
  localData.value = newData
}

// Load categories on mount
loadCategories()
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-muted-foreground">
      {{ t('mcpCatalog.form.basic.subtitle') }}
      <span v-if="isAutoPopulated"> (auto-populated from GitHub)</span>
    </p>

    <!-- Auto-population success indicator -->
    <Alert v-if="isAutoPopulated" class="border-green-200 bg-green-50">
      <CheckCircle class="h-4 w-4 text-green-600" />
      <AlertDescription class="text-green-800">
        Information automatically populated from GitHub repository. Please review and edit as needed.
      </AlertDescription>
    </Alert>

    <div class="mt-6 border-t border-gray-100">
      <dl class="divide-y divide-gray-100">
        <!-- Server Name -->
        <SharedFormField
          :label="t('mcpCatalog.form.basic.name.label')"
          :description="t('mcpCatalog.form.basic.name.description')"
          required
        >
          <Input
            id="name"
            :model-value="localData.name"
            @update:model-value="(value) => updateField('name', String(value))"
            :placeholder="t('mcpCatalog.form.basic.name.placeholder')"
            required
          />
        </SharedFormField>

        <!-- Category -->
        <SharedFormField
          :label="t('mcpCatalog.form.basic.category.label')"
          :description="t('mcpCatalog.form.basic.category.description')"
        >
          <Select
            :model-value="localData.category_id"
            @update:model-value="(value) => updateField('category_id', String(value || ''))"
            :disabled="categoriesLoading"
          >
            <SelectTrigger>
              <div class="flex items-center gap-2">
                <DynamicIcon
                  v-if="selectedCategory?.icon"
                  :name="selectedCategory.icon"
                  class="h-4 w-4 shrink-0 text-muted-foreground"
                />
                <span class="truncate">
                  {{ selectedCategory?.name || (categoriesLoading ? 'Loading categories...' : t('mcpCatalog.form.basic.category.placeholder')) }}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="category in categories"
                :key="category.id"
                :value="category.id"
              >
                <div class="flex items-center gap-2">
                  <DynamicIcon
                    v-if="category.icon"
                    :name="category.icon"
                    class="h-4 w-4 shrink-0 text-muted-foreground"
                  />
                  <span>{{ category.name }}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </SharedFormField>

        <!-- Short Description -->
        <SharedFormField
          :label="t('mcpCatalog.form.basic.description.label')"
          :description="t('mcpCatalog.form.basic.description.description')"
          required
        >
          <Textarea
            id="description"
            :model-value="localData.description"
            @update:model-value="(value) => updateField('description', String(value))"
            :placeholder="t('mcpCatalog.form.basic.description.placeholder')"
            rows="3"
            required
          />
        </SharedFormField>

        <!-- Long Description -->
        <SharedFormField
          :label="t('mcpCatalog.form.basic.longDescription.label')"
          :description="t('mcpCatalog.form.basic.longDescription.description')"
        >
          <Textarea
            id="long_description"
            :model-value="localData.long_description"
            @update:model-value="(value) => updateField('long_description', String(value))"
            :placeholder="t('mcpCatalog.form.basic.longDescription.placeholder')"
            rows="5"
          />
        </SharedFormField>

        <!-- Featured Server -->
        <SharedFormField
          :label="t('mcpCatalog.form.basic.featured.label')"
          :description="t('mcpCatalog.form.basic.featured.description')"
        >
          <div class="flex items-center space-x-3">
            <Switch
              id="featured"
              :model-value="localData.featured"
              @update:model-value="(value) => updateField('featured', value)"
            />
            <span class="text-sm text-gray-700">
              {{ localData.featured ? 'Yes' : 'No' }}
            </span>
          </div>
        </SharedFormField>

        <!-- Auto Install for New Default Teams -->
        <SharedFormField
          :label="t('mcpCatalog.form.basic.autoInstall.label')"
          :description="t('mcpCatalog.form.basic.autoInstall.description')"
        >
          <div class="flex items-center space-x-3">
            <Switch
              id="auto_install_new_default_team"
              :model-value="localData.auto_install_new_default_team"
              @update:model-value="(value) => updateField('auto_install_new_default_team', value)"
            />
            <span class="text-sm text-gray-700">
              {{ localData.auto_install_new_default_team ? 'Yes' : 'No' }}
            </span>
          </div>
        </SharedFormField>

        <!-- Language -->
        <SharedFormField
          label="Programming Language"
          description="The primary programming language used by this MCP server (auto-detected from command)"
        >
          <Select
            :model-value="localData.language"
            @update:model-value="(value) => updateField('language', String(value || 'typescript'))"
          >
            <SelectTrigger>
              <span>
                {{ LANGUAGE_OPTIONS.find(opt => opt.value === localData.language)?.label || 'Select language' }}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in LANGUAGE_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </SharedFormField>

        <!-- Runtime -->
        <SharedFormField
          label="Runtime Environment"
          description="The runtime environment required to run this MCP server (auto-detected from command)"
        >
          <Select
            :model-value="localData.runtime"
            @update:model-value="(value) => updateField('runtime', String(value || 'node'))"
          >
            <SelectTrigger>
              <span>
                {{ RUNTIME_OPTIONS.find(opt => opt.value === localData.runtime)?.label || 'Select runtime' }}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in RUNTIME_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </SharedFormField>

        <!-- Author Name -->
        <SharedFormField
          :label="t('mcpCatalog.form.basic.author.label')"
          :description="t('mcpCatalog.form.basic.author.description')"
        >
          <Input
            id="author_name"
            :model-value="localData.author_name"
            @update:model-value="(value) => updateField('author_name', String(value))"
            :placeholder="t('mcpCatalog.form.basic.author.placeholder')"
          />
        </SharedFormField>

        <!-- Author Contact -->
        <SharedFormField
          :label="t('mcpCatalog.form.basic.contact.label')"
          :description="t('mcpCatalog.form.basic.contact.description')"
        >
          <Input
            id="author_contact"
            :model-value="localData.author_contact"
            @update:model-value="(value) => updateField('author_contact', String(value))"
            :placeholder="t('mcpCatalog.form.basic.contact.placeholder')"
          />
        </SharedFormField>

        <!-- Organization -->
        <SharedFormField
          :label="t('mcpCatalog.form.basic.organization.label')"
          :description="t('mcpCatalog.form.basic.organization.description')"
        >
          <Input
            id="organization"
            :model-value="localData.organization"
            @update:model-value="(value) => updateField('organization', String(value))"
            :placeholder="t('mcpCatalog.form.basic.organization.placeholder')"
          />
        </SharedFormField>

        <!-- License -->
        <SharedFormField
          :label="t('mcpCatalog.form.basic.license.label')"
          :description="t('mcpCatalog.form.basic.license.description')"
        >
          <Input
            id="license"
            :model-value="localData.license"
            @update:model-value="(value) => updateField('license', String(value))"
            :placeholder="t('mcpCatalog.form.basic.license.placeholder')"
          />
        </SharedFormField>

        <!-- Website URL -->
        <SharedFormField
          :label="t('mcpCatalog.form.basic.websiteUrl.label')"
          :description="t('mcpCatalog.form.basic.websiteUrl.description')"
        >
          <Input
            id="website_url"
            :model-value="localData.website_url"
            @update:model-value="(value) => updateField('website_url', String(value))"
            :placeholder="t('mcpCatalog.form.basic.websiteUrl.placeholder')"
            type="url"
          />
        </SharedFormField>

        <!-- Icon URL -->
        <SharedFormField
          label="Icon URL"
          description="URL to the server icon image (auto-generated from GitHub avatar if not provided)"
        >
          <Input
            id="icon_url"
            :model-value="localData.icon_url"
            @update:model-value="(value) => updateField('icon_url', String(value))"
            placeholder="https://example.com/icon.png"
            type="url"
          />
        </SharedFormField>

        <!-- Tags -->
        <SharedFormField
          :label="t('mcpCatalog.form.basic.tags.label')"
          :description="t('mcpCatalog.form.basic.tags.description')"
        >
          <!-- Existing Tags -->
          <div v-if="localData.tags.length > 0" class="flex flex-wrap gap-2 mb-3">
            <Badge
              v-for="tag in localData.tags"
              :key="tag"
              variant="secondary"
              class="flex items-center gap-1"
            >
              {{ tag }}
              <Button
                variant="ghost"
                size="sm"
                class="h-4 w-4 p-0 hover:bg-transparent"
                @click="removeTag(tag)"
              >
                <X class="h-3 w-3" />
              </Button>
            </Badge>
          </div>

          <!-- Add New Tag -->
          <div class="flex gap-2">
            <Input
              v-model="newTag"
              :placeholder="t('mcpCatalog.form.basic.tags.placeholder')"
              @keydown="handleTagKeydown"
              class="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              @click="addTag"
              :disabled="!newTag.trim()"
            >
              <Plus class="h-4 w-4" />
            </Button>
          </div>
        </SharedFormField>

      </dl>
    </div>
  </div>
</template>
