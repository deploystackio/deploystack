<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
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
import type { BasicInfoFormData, McpCategory } from '@/views/admin/mcp-server-catalog/types'
import { McpCategoriesCache } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'

interface Props {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  formData?: any
  mode?: 'create' | 'edit'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create'
})
const { t } = useI18n()
const eventBus = useEventBus()

// Storage key for basic info data
const STORAGE_KEY = 'edit_basic_data'

// Local reactive data - storage-first approach
const localData = ref<BasicInfoFormData>({
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
  auto_install_new_default_team: false
})

// Categories
const categories = ref<McpCategory[]>([])
const categoriesLoading = ref(true)

// New tag input
const newTag = ref('')

// Check if data was auto-populated from GitHub
const isAutoPopulated = computed(() => {
  return props.formData?.github?.auto_populated || false
})

// Load data from storage
const loadFromStorage = () => {
  const storedData = eventBus.getState<BasicInfoFormData>(STORAGE_KEY)
  if (storedData) {
    localData.value = { ...localData.value, ...storedData }
  }
}

// Flag to prevent recursive updates
let isUpdatingFromStorage = false

// Save data to storage
const saveToStorage = () => {
  if (!isUpdatingFromStorage) {
    eventBus.setState(STORAGE_KEY, localData.value)
  }
}

// Update field and save to storage
const updateField = <K extends keyof BasicInfoFormData>(field: K, value: BasicInfoFormData[K]) => {
  localData.value[field] = value
  saveToStorage()
}

// Load categories
const loadCategories = async () => {
  try {
    categoriesLoading.value = true
    categories.value = await McpCategoriesCache.getCategories()
  } catch (error) {
    console.error('Failed to load categories:', error)
  } finally {
    categoriesLoading.value = false
  }
}

// Tag management
const addTag = () => {
  if (newTag.value.trim() && !localData.value.tags.includes(newTag.value.trim())) {
    updateField('tags', [...localData.value.tags, newTag.value.trim()])
    newTag.value = ''
  }
}

const removeTag = (tagToRemove: string) => {
  updateField('tags', localData.value.tags.filter(tag => tag !== tagToRemove))
}

const handleTagKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    addTag()
  }
}

// Listen for storage changes from other components
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const handleStorageChange = (data: { key: string; newValue: any }) => {
  if (data.key === STORAGE_KEY && data.newValue) {
    isUpdatingFromStorage = true
    localData.value = { ...localData.value, ...data.newValue }
    // Reset flag after Vue's next tick to allow the watcher to run
    setTimeout(() => {
      isUpdatingFromStorage = false
    }, 0)
  }
}

// Watch for changes in localData and save to storage
watch(localData, saveToStorage, { deep: true })

onMounted(() => {
  loadCategories()
  loadFromStorage()

  // Listen for storage changes
  eventBus.on('storage-changed', handleStorageChange)
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
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.name.label') }}</dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
            <Input
              id="name"
              :model-value="localData.name"
              @update:model-value="(value) => updateField('name', String(value))"
              :placeholder="t('mcpCatalog.form.basic.name.placeholder')"
              required
            />
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('mcpCatalog.form.basic.name.description') }}
            </p>
          </dd>
        </div>

        <!-- Category -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.category.label') }}</dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
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
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('mcpCatalog.form.basic.category.description') }}
            </p>
          </dd>
        </div>

        <!-- Short Description -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.description.label') }}</dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
            <Textarea
              id="description"
              :model-value="localData.description"
              @update:model-value="(value) => updateField('description', String(value))"
              :placeholder="t('mcpCatalog.form.basic.description.placeholder')"
              rows="3"
              required
            />
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('mcpCatalog.form.basic.description.description') }}
            </p>
          </dd>
        </div>

        <!-- Long Description -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.longDescription.label') }}</dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
            <Textarea
              id="long_description"
              :model-value="localData.long_description"
              @update:model-value="(value) => updateField('long_description', String(value))"
              :placeholder="t('mcpCatalog.form.basic.longDescription.placeholder')"
              rows="5"
            />
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('mcpCatalog.form.basic.longDescription.description') }}
            </p>
          </dd>
        </div>

        <!-- Featured Server -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.featured.label') }}</dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
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
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('mcpCatalog.form.basic.featured.description') }}
            </p>
          </dd>
        </div>

        <!-- Auto Install for New Default Teams -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.autoInstall.label') }}</dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
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
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('mcpCatalog.form.basic.autoInstall.description') }}
            </p>
          </dd>
        </div>

        <!-- Author Name -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.author.label') }}</dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
            <Input
              id="author_name"
              :model-value="localData.author_name"
              @update:model-value="(value) => updateField('author_name', String(value))"
              :placeholder="t('mcpCatalog.form.basic.author.placeholder')"
            />
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('mcpCatalog.form.basic.author.description') }}
            </p>
          </dd>
        </div>

        <!-- Author Contact -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.contact.label') }}</dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
            <Input
              id="author_contact"
              :model-value="localData.author_contact"
              @update:model-value="(value) => updateField('author_contact', String(value))"
              :placeholder="t('mcpCatalog.form.basic.contact.placeholder')"
            />
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('mcpCatalog.form.basic.contact.description') }}
            </p>
          </dd>
        </div>

        <!-- Organization -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.organization.label') }}</dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
            <Input
              id="organization"
              :model-value="localData.organization"
              @update:model-value="(value) => updateField('organization', String(value))"
              :placeholder="t('mcpCatalog.form.basic.organization.placeholder')"
            />
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('mcpCatalog.form.basic.organization.description') }}
            </p>
          </dd>
        </div>

        <!-- License -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.license.label') }}</dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
            <Input
              id="license"
              :model-value="localData.license"
              @update:model-value="(value) => updateField('license', String(value))"
              :placeholder="t('mcpCatalog.form.basic.license.placeholder')"
            />
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('mcpCatalog.form.basic.license.description') }}
            </p>
          </dd>
        </div>

        <!-- Tags -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.tags.label') }}</dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
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

            <p class="text-xs text-muted-foreground mt-1">
              {{ t('mcpCatalog.form.basic.tags.description') }}
            </p>
          </dd>
        </div>

      </dl>
    </div>
  </div>
</template>
