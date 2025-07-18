<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Edit, Trash2, Settings } from 'lucide-vue-next'
import type { EnvironmentVariable } from '@/views/admin/mcp-server-catalog/types'

// Extended interface for form editing
interface ExtendedEnvironmentVariable extends EnvironmentVariable {
  type?: string
  validation?: string
  placeholder?: string
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any
}

interface Emits {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (e: 'update:formData', value: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// Modal state
const isModalOpen = ref(false)
const modalMode = ref<'add' | 'edit'>('add')
const editingIndex = ref(-1)

// Form state
const formDataLocal = ref<ExtendedEnvironmentVariable>({
  name: '',
  description: '',
  required: false,
  type: 'text',
  validation: '',
  placeholder: ''
})

const formErrors = ref<Record<string, string>>({})

// Computed properties
const environmentVariables = computed(() => {
  return props.formData?.capabilities?.environment_variables || []
})

const isFormValid = computed(() => {
  return formDataLocal.value.name.trim() !== '' && Object.keys(formErrors.value).length === 0
})

// Modal management
const openAddModal = () => {
  modalMode.value = 'add'
  editingIndex.value = -1
  resetForm()
  isModalOpen.value = true
}

const openEditModal = (index: number) => {
  modalMode.value = 'edit'
  editingIndex.value = index
  const variable = environmentVariables.value[index]
  formDataLocal.value = { ...variable }
  formErrors.value = {}
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
  resetForm()
}

const resetForm = () => {
  formDataLocal.value = {
    name: '',
    description: '',
    required: false,
    type: 'text',
    validation: '',
    placeholder: ''
  }
  formErrors.value = {}
}

// Form validation
const validateForm = () => {
  const errors: Record<string, string> = {}

  if (!formDataLocal.value.name.trim()) {
    errors.name = 'Name is required'
  } else if (!/^[A-Z_][A-Z0-9_]*$/.test(formDataLocal.value.name)) {
    errors.name = 'Name must be uppercase letters, numbers, and underscores only'
  } else {
    // Check for duplicates (excluding current item when editing)
    const isDuplicate = environmentVariables.value.some((variable: EnvironmentVariable, index: number) =>
      variable.name === formDataLocal.value.name && index !== editingIndex.value
    )
    if (isDuplicate) {
      errors.name = 'Environment variable with this name already exists'
    }
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

// CRUD operations
const handleSubmit = () => {
  // Transform name to uppercase before validation and saving
  formDataLocal.value.name = formDataLocal.value.name.toUpperCase()

  if (!validateForm()) return

  const updatedVariables = [...environmentVariables.value]

  if (modalMode.value === 'add') {
    updatedVariables.push({ ...formDataLocal.value })
  } else {
    updatedVariables[editingIndex.value] = { ...formDataLocal.value }
  }

  updateFormData(updatedVariables)
  closeModal()
}

const handleDelete = (index: number) => {
  const updatedVariables = environmentVariables.value.filter((_: EnvironmentVariable, i: number) => i !== index)
  updateFormData(updatedVariables)
}

const updateFormData = (newEnvironmentVariables: EnvironmentVariable[]) => {
  const updatedFormData = {
    ...props.formData,
    capabilities: {
      ...props.formData.capabilities,
      environment_variables: newEnvironmentVariables
    }
  }
  emit('update:formData', updatedFormData)
}

const modalTitle = computed(() => {
  return modalMode.value === 'add'
    ? t('mcpCatalog.form.capabilities.environmentVariables.addVariable')
    : t('mcpCatalog.form.capabilities.environmentVariables.editVariable')
})
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div>
      <h3 class="text-lg font-medium">{{ t('mcpCatalog.form.capabilities.title') }}</h3>
      <p class="text-sm text-muted-foreground">{{ t('mcpCatalog.form.capabilities.subtitle') }}</p>
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
          @click="openAddModal"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('mcpCatalog.form.capabilities.environmentVariables.addVariable') }}
        </Button>
      </div>

      <!-- Environment Variables Display with Edit Actions -->
      <div v-if="environmentVariables.length > 0" class="space-y-2">
        <div
          v-for="(variable, index) in environmentVariables"
          :key="index"
          class="flex items-center justify-between p-4 border rounded-lg bg-gray-50"
        >
          <div class="flex items-center gap-3">
            <Settings class="h-5 w-5 text-gray-400" />
            <div class="flex flex-col">
              <span class="font-mono text-sm font-medium">{{ variable.name }}</span>
              <span v-if="variable.description" class="text-xs text-gray-500">{{ variable.description }}</span>
              <div class="flex gap-2 mt-1">
                <Badge v-if="variable.required" variant="destructive" class="text-xs">Required</Badge>
                <Badge v-if="variable.type" variant="outline" class="text-xs">{{ variable.type }}</Badge>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              @click="openEditModal(index)"
              class="h-8 w-8 p-0"
            >
              <span class="sr-only">Edit {{ variable.name }}</span>
              <Edit class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              @click="handleDelete(index)"
              class="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            >
              <span class="sr-only">Delete {{ variable.name }}</span>
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
        <Settings class="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p>{{ t('mcpCatalog.form.capabilities.environmentVariables.noVariables') }}</p>
        <p class="text-sm">Click "{{ t('mcpCatalog.form.capabilities.environmentVariables.addVariable') }}" to get started.</p>
      </div>
    </div>

    <!-- Add/Edit Environment Variable Modal -->
    <AlertDialog :open="isModalOpen" @update:open="(value) => isModalOpen = value">
      <AlertDialogContent class="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ modalTitle }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ modalMode === 'add'
              ? 'Add a new environment variable that this MCP server requires.'
              : 'Edit the environment variable details.'
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Variable Name -->
          <div class="space-y-2">
            <Label for="var-name">{{ t('mcpCatalog.form.capabilities.environmentVariables.name.label') }}</Label>
            <Input
              id="var-name"
              v-model="formDataLocal.name"
              :placeholder="t('mcpCatalog.form.capabilities.environmentVariables.name.placeholder')"
              :class="{ 'border-destructive': formErrors.name }"
              class="font-mono"
              required
            />
            <div v-if="formErrors.name" class="text-sm text-destructive">
              {{ formErrors.name }}
            </div>
          </div>

          <!-- Description -->
          <div class="space-y-2">
            <Label for="var-description">{{ t('mcpCatalog.form.capabilities.environmentVariables.variableDescription.label') }}</Label>
            <Textarea
              id="var-description"
              v-model="formDataLocal.description"
              :placeholder="t('mcpCatalog.form.capabilities.environmentVariables.variableDescription.placeholder')"
              rows="2"
            />
          </div>

          <!-- Type -->
          <div class="space-y-2">
            <Label for="var-type">Type</Label>
            <Select v-model="formDataLocal.type">
              <SelectTrigger>
                <SelectValue placeholder="Select variable type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Placeholder -->
          <div class="space-y-2">
            <Label for="var-placeholder">Placeholder</Label>
            <Input
              id="var-placeholder"
              v-model="formDataLocal.placeholder"
              placeholder="Example value or hint for users"
            />
          </div>

          <!-- Required Toggle -->
          <div class="flex items-center space-x-2">
            <Switch
              id="var-required"
              :checked="formDataLocal.required"
              @update:checked="(value: boolean) => formDataLocal.required = value"
            />
            <Label for="var-required">{{ t('mcpCatalog.form.capabilities.environmentVariables.required.description') }}</Label>
          </div>

          <!-- Validation (Advanced) -->
          <div class="space-y-2">
            <Label for="var-validation">Validation Pattern (Optional)</Label>
            <Input
              id="var-validation"
              v-model="formDataLocal.validation"
              placeholder="Regular expression for validation"
              class="font-mono text-sm"
            />
            <p class="text-xs text-muted-foreground">
              Optional regex pattern to validate the environment variable value.
            </p>
          </div>

          <AlertDialogFooter>
            <Button type="button" variant="outline" @click="closeModal">
              {{ t('mcpCatalog.form.navigation.cancel') }}
            </Button>
            <Button type="submit" :disabled="!isFormValid">
              {{ modalMode === 'add' ? 'Add Variable' : 'Save Changes' }}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
