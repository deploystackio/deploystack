<!--
 * STORAGE-FIRST ARCHITECTURE
 *
 * This component uses storage-first architecture where:
 * - All form data is stored in localStorage via the event bus
 * - Component reads/writes directly to storage, not through v-model props
 * - Real-time synchronization across all wizard steps
 * - No v-model props or emit patterns
 *
 * Storage key: 'edit_basic_data'
 -->

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { X, Plus, CheckCircle } from 'lucide-vue-next'
import type { BasicInfoFormData } from '@/views/admin/mcp-server-catalog/types'
import { useEventBus } from '@/composables/useEventBus'
import { useCategories } from '@/composables/admin/mcp-catalog/useCategories'
import { useTagManager } from '@/composables/admin/mcp-catalog/useTagManager'
import SharedFormField from '../shared/SharedFormField.vue'

interface Props {
  modelValue?: BasicInfoFormData  // Keep for backward compatibility but don't use
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  formData?: any
  mode?: 'create' | 'edit'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create'
})

// Emits kept for backward compatibility but not used in storage-first
const emit = defineEmits<{
  'update:modelValue': [value: BasicInfoFormData]
}>()

const { t } = useI18n()
const eventBus = useEventBus()

// Storage key for this step
const STORAGE_KEY = 'edit_basic_data'

// Default form data structure
const defaultData: BasicInfoFormData = {
  name: '',
  description: '',
  long_description: '',
  category_id: '',
  author_name: '',
  author_contact: '',
  organization: '',
  license: '',
  tags: [],
  featured: false,
  auto_install_new_default_team: false,
  website_url: '',
  icon_url: ''
}

// Storage-first reactive data - using ref instead of computed for better reactivity
const localData = ref<BasicInfoFormData>(defaultData)

// Function to load data from storage
const loadFromStorage = () => {
  const storedData = eventBus.getState<BasicInfoFormData>(STORAGE_KEY, defaultData)
  localData.value = storedData || defaultData
}

// Function to save data to storage
const saveToStorage = (data: BasicInfoFormData) => {
  eventBus.setState(STORAGE_KEY, data)
  // Emit for backward compatibility
  emit('update:modelValue', data)
}

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

// Check if data was auto-populated from GitHub
const isAutoPopulated = computed(() => {
  return props.formData?.github?.auto_populated || false
})

// Update field using storage-first pattern
const updateField = <K extends keyof BasicInfoFormData>(field: K, value: BasicInfoFormData[K]) => {
  const newData = {
    ...localData.value,
    [field]: value
  }
  localData.value = newData
  saveToStorage(newData)
}

// Storage change handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleStorageChange = (data: { key: string; oldValue: any; newValue: any }) => {
  if (data.key === STORAGE_KEY) {
    // Storage changed externally, update local reactive data
    loadFromStorage()
  }
}

// Lifecycle
onMounted(() => {
  loadCategories()

  // Load initial data from storage
  loadFromStorage()

  // Listen for storage changes from other components
  eventBus.on('storage-changed', handleStorageChange)

  // Initialize from props in edit mode if storage is empty
  if (props.mode === 'edit' && props.modelValue) {
    const currentData = eventBus.getState<BasicInfoFormData>(STORAGE_KEY)
    if (!currentData || Object.keys(currentData).length === 0) {
      localData.value = props.modelValue
      saveToStorage(props.modelValue)
    }
  }
})

onUnmounted(() => {
  // Clean up event listeners
  eventBus.off('storage-changed', handleStorageChange)
})
</script>

<template>
  <div class="space-y-6">
    <div class="px-4 sm:px-0">
      <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpCatalog.form.basic.title') }}</h3>
      <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">
        {{ t('mcpCatalog.form.basic.subtitle') }}
        <span v-if="isAutoPopulated"> (auto-populated from GitHub)</span>
      </p>
    </div>

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
              <SelectValue
                :placeholder="categoriesLoading
                  ? 'Loading categories...'
                  : t('mcpCatalog.form.basic.category.placeholder')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="category in categories"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
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
