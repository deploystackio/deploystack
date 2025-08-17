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
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { X, Plus, CheckCircle } from 'lucide-vue-next'
import type { BasicInfoFormData, McpCategory } from '@/views/admin/mcp-server-catalog/types'
import { McpCategoriesCache } from '@/services/mcpCatalogService'
import { ref, onMounted } from 'vue'

interface Props {
  modelValue: BasicInfoFormData
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  formData: any
}

interface Emits {
  (e: 'update:modelValue', value: BasicInfoFormData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// Categories
const categories = ref<McpCategory[]>([])
const categoriesLoading = ref(true)

// New tag input
const newTag = ref('')

// Computed model
const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Specific computed for featured field to handle boolean updates properly
const featuredValue = computed({
  get: () => props.modelValue.featured,
  set: (value: boolean) => {
    const updatedValue = {
      ...props.modelValue,
      featured: value
    }
    emit('update:modelValue', updatedValue)
  }
})

// Check if data was auto-populated from GitHub
const isAutoPopulated = computed(() => {
  return props.formData.github?.auto_populated || false
})


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
  if (newTag.value.trim() && !localValue.value.tags.includes(newTag.value.trim())) {
    localValue.value = {
      ...localValue.value,
      tags: [...localValue.value.tags, newTag.value.trim()]
    }
    newTag.value = ''
  }
}

const removeTag = (tagToRemove: string) => {
  localValue.value = {
    ...localValue.value,
    tags: localValue.value.tags.filter(tag => tag !== tagToRemove)
  }
}

const handleTagKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    addTag()
  }
}

onMounted(() => {
  loadCategories()
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
              v-model="localValue.name"
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
            <Select v-model="localValue.category_id" :disabled="categoriesLoading">
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
              v-model="localValue.description"
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
              v-model="localValue.long_description"
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
                v-model="featuredValue"
              />
              <span class="text-sm text-gray-700">
                {{ featuredValue ? 'Yes' : 'No' }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('mcpCatalog.form.basic.featured.description') }}
            </p>
          </dd>
        </div>

        <!-- Author Name -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.author.label') }}</dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
            <Input
              id="author_name"
              v-model="localValue.author_name"
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
              v-model="localValue.author_contact"
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
              v-model="localValue.organization"
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
              v-model="localValue.license"
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
            <div v-if="localValue.tags.length > 0" class="flex flex-wrap gap-2 mb-3">
              <Badge
                v-for="tag in localValue.tags"
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
