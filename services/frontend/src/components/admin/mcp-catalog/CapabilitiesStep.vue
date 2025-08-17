<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Edit, Trash2, Settings, MoreHorizontal } from 'lucide-vue-next'
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
    errors.name = t('mcpCatalog.form.capabilities.environmentVariables.validation.nameRequired')
  } else if (!/^[A-Z_][A-Z0-9_]*$/.test(formDataLocal.value.name)) {
    errors.name = t('mcpCatalog.form.capabilities.environmentVariables.validation.nameFormat')
  } else {
    // Check for duplicates (excluding current item when editing)
    // Only check for duplicates if the name has actually changed
    const currentItem = modalMode.value === 'edit' ? environmentVariables.value[editingIndex.value] : null
    const nameChanged = !currentItem || currentItem.name !== formDataLocal.value.name

    if (nameChanged) {
      const isDuplicate = environmentVariables.value.some((variable: EnvironmentVariable, index: number) =>
        variable.name === formDataLocal.value.name && index !== editingIndex.value
      )
      if (isDuplicate) {
        errors.name = t('mcpCatalog.form.capabilities.environmentVariables.validation.nameDuplicate')
      }
    }
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

// CRUD operations
const handleSubmit = () => {
  // Only transform name to uppercase if it's not already uppercase (avoid unnecessary changes)
  const originalName = formDataLocal.value.name
  formDataLocal.value.name = formDataLocal.value.name.toUpperCase()

  if (!validateForm()) {
    // Restore original name if validation fails to prevent side effects
    formDataLocal.value.name = originalName
    return
  }

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
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium">{{ t('mcpCatalog.form.capabilities.environmentVariables.label') }}</h3>
      <p class="text-sm text-muted-foreground">
        {{ t('mcpCatalog.form.capabilities.environmentVariables.description') }}
      </p>
    </div>

    <!-- Header with Add Button -->
    <div class="flex items-center justify-between">
      <div></div>
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
    <div v-if="environmentVariables.length > 0" class="overflow-hidden">
      <table class="w-full text-left">
        <thead class="sr-only">
          <tr>
            <th>{{ t('mcpCatalog.form.capabilities.environmentVariables.name.label') }}</th>
            <th class="hidden sm:table-cell">{{ t('mcpCatalog.table.columns.properties', 'Properties') }}</th>
            <th class="hidden sm:table-cell">{{ t('mcpCatalog.table.columns.details', 'Details') }}</th>
            <th>{{ t('mcpCatalog.table.columns.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(variable, index) in environmentVariables" :key="index">
            <td class="relative py-5 pr-6">
              <div class="flex gap-x-6">
                <div class="flex-auto">
                  <div class="flex items-start gap-x-3">
                    <div class="text-sm/6 font-semibold text-gray-900">
                      {{ variable.name }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="absolute right-full bottom-0 h-px w-screen bg-gray-100" />
              <div class="absolute bottom-0 left-0 h-px w-screen bg-gray-100" />
            </td>
            <td class="hidden py-5 pr-6 sm:table-cell">
              <div class="space-y-1">
                <div v-if="variable.required" class="text-xs/5 text-gray-500">
                  <span class="font-medium">{{ t('mcpCatalog.form.capabilities.environmentVariables.required.label') }}:</span> {{ t('common.labels.yes') }}
                </div>
                <div v-if="variable.type" class="text-xs/5 text-gray-500">
                  <span class="font-medium">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.label') }}:</span> {{ variable.type }}
                </div>
              </div>
            </td>
            <td class="hidden py-5 pr-6 sm:table-cell">
              <div v-if="variable.description" class="text-sm/6 text-gray-900">
                {{ variable.description }}
              </div>
              <div v-if="variable.placeholder" class="mt-1 text-xs/5 text-gray-500">
                {{ t('mcpCatalog.form.capabilities.environmentVariables.placeholder.label') }}: {{ variable.placeholder }}
              </div>
            </td>
            <td class="py-5 text-right">
              <div class="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" class="h-8 w-8 p-0">
                      <span class="sr-only">{{ t('mcpCatalog.table.openMenu') }} {{ variable.name }}</span>
                      <MoreHorizontal class="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click="openEditModal(index)">
                      <Edit class="mr-2 h-4 w-4" />
                      {{ t('mcpCatalog.table.actions.edit') }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      @click="handleDelete(index)"
                      class="text-red-600 focus:text-red-600"
                    >
                      <Trash2 class="mr-2 h-4 w-4" />
                      {{ t('mcpCatalog.table.actions.delete') }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
        <Settings class="h-6 w-6 text-gray-400" />
      </div>
      <h3 class="text-sm font-medium text-gray-900 mb-2">{{ t('mcpCatalog.form.capabilities.environmentVariables.noVariables') }}</h3>
      <p class="text-sm text-gray-500 max-w-sm mx-auto">
        {{ t('mcpCatalog.form.capabilities.environmentVariables.noVariablesDescription') }}
      </p>
    </div>

    <!-- Add/Edit Environment Variable Modal -->
    <AlertDialog :open="isModalOpen" @update:open="(value) => isModalOpen = value">
      <AlertDialogContent class="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ modalTitle }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ modalMode === 'add'
              ? t('mcpCatalog.form.capabilities.environmentVariables.addDescription')
              : t('mcpCatalog.form.capabilities.environmentVariables.editDescription')
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
            <Label for="var-type">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.label') }}</Label>
            <Select v-model="formDataLocal.type">
              <SelectTrigger>
                <SelectValue :placeholder="t('mcpCatalog.form.capabilities.environmentVariables.type.placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.options.text') }}</SelectItem>
                <SelectItem value="password">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.options.password') }}</SelectItem>
                <SelectItem value="number">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.options.number') }}</SelectItem>
                <SelectItem value="url">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.options.url') }}</SelectItem>
                <SelectItem value="email">{{ t('mcpCatalog.form.capabilities.environmentVariables.type.options.email') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Placeholder -->
          <div class="space-y-2">
            <Label for="var-placeholder">{{ t('mcpCatalog.form.capabilities.environmentVariables.placeholder.label') }}</Label>
            <Input
              id="var-placeholder"
              v-model="formDataLocal.placeholder"
              :placeholder="t('mcpCatalog.form.capabilities.environmentVariables.placeholder.placeholder')"
            />
          </div>

          <!-- Required Toggle -->
          <div class="flex items-center space-x-2">
            <Switch
              id="var-required"
              :model-value="formDataLocal.required"
              @update:model-value="(value: boolean) => formDataLocal.required = value"
            />
            <Label for="var-required">{{ t('mcpCatalog.form.capabilities.environmentVariables.required.description') }}</Label>
          </div>

          <!-- Validation (Advanced) -->
          <div class="space-y-2">
            <Label for="var-validation">{{ t('mcpCatalog.form.capabilities.environmentVariables.validation.label') }}</Label>
            <Input
              id="var-validation"
              v-model="formDataLocal.validation"
              :placeholder="t('mcpCatalog.form.capabilities.environmentVariables.validation.placeholder')"
              class="font-mono text-sm"
            />
            <p class="text-xs text-muted-foreground">
              {{ t('mcpCatalog.form.capabilities.environmentVariables.validation.description') }}
            </p>
          </div>

          <AlertDialogFooter>
            <Button type="button" variant="outline" @click="closeModal">
              {{ t('mcpCatalog.form.navigation.cancel') }}
            </Button>
            <Button type="submit" :disabled="!isFormValid">
              {{ modalMode === 'add' ? t('mcpCatalog.form.capabilities.environmentVariables.submitAdd') : t('mcpCatalog.form.capabilities.environmentVariables.submitEdit') }}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
