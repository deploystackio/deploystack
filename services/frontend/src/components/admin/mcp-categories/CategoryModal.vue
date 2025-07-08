<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import IconPicker from '@/components/ui/icon-picker.vue'
import { McpCategoriesService, type McpCategory, type CreateMcpCategoryRequest } from '@/services/mcpCategoriesService'

const { t } = useI18n()

interface Props {
  open: boolean
  category?: McpCategory | null
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'category-created'): void
  (e: 'category-updated'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Form validation schema
const CategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100, 'Category name is too long'),
  description: z.string().optional(),
  icon: z.string().optional(),
  sort_order: z.number().min(0, 'Sort order must be 0 or greater').max(9999, 'Sort order is too large'),
})

// Form state
const formData = ref<CreateMcpCategoryRequest>({
  name: '',
  description: '',
  icon: 'FolderTree',
  sort_order: 0,
})

const isSubmitting = ref(false)
const errors = ref<Record<string, string>>({})

// Computed properties
const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const isEditing = computed(() => !!props.category)
const modalTitle = computed(() =>
  isEditing.value
    ? t('mcpCategories.modal.editTitle')
    : t('mcpCategories.modal.createTitle')
)

const isFormValid = computed(() => {
  return formData.value.name.trim().length > 0 && Object.keys(errors.value).length === 0
})

// Validation
const validateForm = () => {
  errors.value = {}

  try {
    CategorySchema.parse(formData.value)
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        if (err.path.length > 0) {
          errors.value[err.path[0] as string] = err.message
        }
      })
    }
  }
}

// Watch for category changes to populate form
watch(() => props.category, (newCategory) => {
  if (newCategory) {
    formData.value = {
      name: newCategory.name,
      description: newCategory.description || '',
      icon: newCategory.icon || 'FolderTree',
      sort_order: newCategory.sort_order,
    }
  } else {
    formData.value = {
      name: '',
      description: '',
      icon: 'FolderTree',
      sort_order: 0,
    }
  }
  errors.value = {}
}, { immediate: true })

// Watch for modal open/close to reset form
watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    formData.value = {
      name: '',
      description: '',
      icon: 'FolderTree',
      sort_order: 0,
    }
    errors.value = {}
  }
})

// Form submission
const handleSubmit = async () => {
  validateForm()

  if (!isFormValid.value) {
    return
  }

  isSubmitting.value = true

  try {
    const categoryData = {
      name: formData.value.name,
      description: formData.value.description || undefined,
      icon: formData.value.icon === 'none' ? undefined : formData.value.icon || undefined,
      sort_order: formData.value.sort_order,
    }

    if (isEditing.value && props.category) {
      await McpCategoriesService.updateCategory(props.category.id, categoryData)
      emit('category-updated')
    } else {
      await McpCategoriesService.createCategory(categoryData)
      emit('category-created')
    }

    // Reset form
    formData.value = {
      name: '',
      description: '',
      icon: 'FolderTree',
      sort_order: 0,
    }
    errors.value = {}

    // Close modal
    isOpen.value = false
  } catch (error) {
    console.error('Error saving category:', error)

    if (error instanceof Error) {
      errors.value.general = error.message
    } else {
      errors.value.general = t('mcpCategories.modal.errors.unknown')
    }
  } finally {
    isSubmitting.value = false
  }
}

const handleCancel = () => {
  // Reset form
  formData.value = {
    name: '',
    description: '',
    icon: 'FolderTree',
    sort_order: 0,
  }
  errors.value = {}
  isOpen.value = false
}

// Form field change handlers
const handleNameChange = () => {
  if (errors.value.name) {
    validateForm()
  }
}

const handleDescriptionChange = () => {
  if (errors.value.description) {
    validateForm()
  }
}

const handleSortOrderChange = () => {
  if (errors.value.sort_order) {
    validateForm()
  }
}
</script>

<template>
  <AlertDialog :open="isOpen" @update:open="(value) => isOpen = value">
    <AlertDialogContent class="sm:max-w-[425px]">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ modalTitle }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ isEditing
            ? t('mcpCategories.modal.editDescription')
            : t('mcpCategories.modal.createDescription')
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- General Error -->
        <div v-if="errors.general" class="text-sm text-destructive">
          {{ errors.general }}
        </div>

        <!-- Category Name -->
        <div class="space-y-2">
          <Label for="category-name">{{ t('mcpCategories.modal.form.name.label') }}</Label>
          <Input
            id="category-name"
            v-model="formData.name"
            :placeholder="t('mcpCategories.modal.form.name.placeholder')"
            :class="{ 'border-destructive': errors.name }"
            @input="handleNameChange"
            required
          />
          <div v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </div>
        </div>

        <!-- Category Description -->
        <div class="space-y-2">
          <Label for="category-description">{{ t('mcpCategories.modal.form.description.label') }}</Label>
          <textarea
            id="category-description"
            v-model="formData.description"
            :placeholder="t('mcpCategories.modal.form.description.placeholder')"
            :class="[
              'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              { 'border-destructive': errors.description }
            ]"
            @input="handleDescriptionChange"
            rows="3"
          />
          <div v-if="errors.description" class="text-sm text-destructive">
            {{ errors.description }}
          </div>
        </div>

        <!-- Icon Selection -->
        <div class="space-y-2">
          <Label for="category-icon">{{ t('mcpCategories.modal.form.icon.label') }}</Label>
          <IconPicker
            v-model="formData.icon"
            :placeholder="t('mcpCategories.modal.form.icon.placeholder')"
          />
          <div v-if="errors.icon" class="text-sm text-destructive">
            {{ errors.icon }}
          </div>
        </div>

        <!-- Sort Order -->
        <div class="space-y-2">
          <Label for="category-sort-order">{{ t('mcpCategories.modal.form.sortOrder.label') }}</Label>
          <Input
            id="category-sort-order"
            v-model.number="formData.sort_order"
            type="number"
            min="0"
            max="9999"
            :placeholder="t('mcpCategories.modal.form.sortOrder.placeholder')"
            :class="{ 'border-destructive': errors.sort_order }"
            @input="handleSortOrderChange"
          />
          <div v-if="errors.sort_order" class="text-sm text-destructive">
            {{ errors.sort_order }}
          </div>
        </div>

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="handleCancel"
            :disabled="isSubmitting"
          >
            {{ t('mcpCategories.modal.cancel') }}
          </Button>
          <Button
            type="submit"
            :disabled="!isFormValid || isSubmitting"
          >
            {{ isSubmitting
              ? t('mcpCategories.modal.saving')
              : (isEditing ? t('mcpCategories.modal.update') : t('mcpCategories.modal.create'))
            }}
          </Button>
        </AlertDialogFooter>
      </form>
    </AlertDialogContent>
  </AlertDialog>
</template>
