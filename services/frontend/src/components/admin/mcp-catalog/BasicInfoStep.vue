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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, Plus } from 'lucide-vue-next'
import type { BasicInfoFormData, McpCategory } from '@/views/admin/mcp-server-catalog/types'
import { McpCategoriesCache } from '@/services/mcpCatalogService'
import { ref, onMounted } from 'vue'

interface Props {
  modelValue: BasicInfoFormData
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
    <div>
      <h3 class="text-lg font-medium">{{ t('mcpCatalog.form.basic.title') }}</h3>
      <p class="text-sm text-muted-foreground">{{ t('mcpCatalog.form.basic.subtitle') }}</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Server Name -->
      <div class="space-y-2">
        <Label for="name">{{ t('mcpCatalog.form.basic.name.label') }}</Label>
        <Input
          id="name"
          v-model="localValue.name"
          :placeholder="t('mcpCatalog.form.basic.name.placeholder')"
          required
        />
        <p class="text-xs text-muted-foreground">
          {{ t('mcpCatalog.form.basic.name.description') }}
        </p>
      </div>

      <!-- Category -->
      <div class="space-y-2">
        <Label for="category">{{ t('mcpCatalog.form.basic.category.label') }}</Label>
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
        <p class="text-xs text-muted-foreground">
          {{ t('mcpCatalog.form.basic.category.description') }}
        </p>
      </div>
    </div>

    <!-- Short Description -->
    <div class="space-y-2">
      <Label for="description">{{ t('mcpCatalog.form.basic.description.label') }}</Label>
      <Textarea
        id="description"
        v-model="localValue.description"
        :placeholder="t('mcpCatalog.form.basic.description.placeholder')"
        rows="3"
        required
      />
      <p class="text-xs text-muted-foreground">
        {{ t('mcpCatalog.form.basic.description.description') }}
      </p>
    </div>

    <!-- Long Description -->
    <div class="space-y-2">
      <Label for="long_description">{{ t('mcpCatalog.form.basic.longDescription.label') }}</Label>
      <Textarea
        id="long_description"
        v-model="localValue.long_description"
        :placeholder="t('mcpCatalog.form.basic.longDescription.placeholder')"
        rows="5"
      />
      <p class="text-xs text-muted-foreground">
        {{ t('mcpCatalog.form.basic.longDescription.description') }}
      </p>
    </div>

    <!-- Author Information -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Author Name -->
      <div class="space-y-2">
        <Label for="author_name">{{ t('mcpCatalog.form.basic.author.label') }}</Label>
        <Input
          id="author_name"
          v-model="localValue.author_name"
          :placeholder="t('mcpCatalog.form.basic.author.placeholder')"
        />
        <p class="text-xs text-muted-foreground">
          {{ t('mcpCatalog.form.basic.author.description') }}
        </p>
      </div>

      <!-- Author Contact -->
      <div class="space-y-2">
        <Label for="author_contact">{{ t('mcpCatalog.form.basic.contact.label') }}</Label>
        <Input
          id="author_contact"
          v-model="localValue.author_contact"
          :placeholder="t('mcpCatalog.form.basic.contact.placeholder')"
        />
        <p class="text-xs text-muted-foreground">
          {{ t('mcpCatalog.form.basic.contact.description') }}
        </p>
      </div>
    </div>

    <!-- Organization and License -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Organization -->
      <div class="space-y-2">
        <Label for="organization">{{ t('mcpCatalog.form.basic.organization.label') }}</Label>
        <Input
          id="organization"
          v-model="localValue.organization"
          :placeholder="t('mcpCatalog.form.basic.organization.placeholder')"
        />
        <p class="text-xs text-muted-foreground">
          {{ t('mcpCatalog.form.basic.organization.description') }}
        </p>
      </div>

      <!-- License -->
      <div class="space-y-2">
        <Label for="license">{{ t('mcpCatalog.form.basic.license.label') }}</Label>
        <Input
          id="license"
          v-model="localValue.license"
          :placeholder="t('mcpCatalog.form.basic.license.placeholder')"
        />
        <p class="text-xs text-muted-foreground">
          {{ t('mcpCatalog.form.basic.license.description') }}
        </p>
      </div>
    </div>

    <!-- Tags -->
    <div class="space-y-2">
      <Label for="tags">{{ t('mcpCatalog.form.basic.tags.label') }}</Label>

      <!-- Existing Tags -->
      <div v-if="localValue.tags.length > 0" class="flex flex-wrap gap-2 mb-2">
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

      <p class="text-xs text-muted-foreground">
        {{ t('mcpCatalog.form.basic.tags.description') }}
      </p>
    </div>
  </div>
</template>
