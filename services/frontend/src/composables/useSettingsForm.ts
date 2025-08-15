import { ref, computed, watch } from 'vue'
import type { Setting } from '@/components/globalSettings/GlobalSettingsSidebarNav.vue'
import { getEnv } from '@/utils/env'

export interface FormValues {
  [key: string]: string | number | boolean
}

export interface ValidationError {
  field: string
  message: string
}

export interface UseSettingsFormOptions {
  onSave?: (values: FormValues) => Promise<void>
  onValidate?: (values: FormValues) => ValidationError[]
  autoSave?: boolean
  autoSaveDelay?: number
}

/**
 * Composable for handling settings form state and operations
 */
export function useSettingsForm(
  settings: Setting[],
  options: UseSettingsFormOptions = {}
) {
  const formValues = ref<FormValues>({})
  const originalValues = ref<FormValues>({})
  const isSaving = ref(false)
  const errors = ref<Record<string, string>>({})
  const isDirty = ref(false)

  const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''

  // Initialize form values from settings
  function initializeFormValues(settingsData: Setting[]) {
    const values: FormValues = {}
    const original: FormValues = {}

    settingsData.forEach(setting => {
      const settingValue = setting.value ?? ''
      let typedValue: string | number | boolean

      switch (setting.type) {
        case 'number':
          typedValue = settingValue ? Number(settingValue) : 0
          break
        case 'boolean':
          if (typeof settingValue === 'string') {
            typedValue = settingValue.toLowerCase() === 'true'
          } else {
            typedValue = Boolean(settingValue)
          }
          break
        case 'string':
        default:
          typedValue = String(settingValue)
          break
      }

      values[setting.key] = typedValue
      original[setting.key] = typedValue
    })

    formValues.value = values
    originalValues.value = original
    isDirty.value = false
  }

  // Check if form has unsaved changes
  const hasChanges = computed(() => {
    return Object.keys(formValues.value).some(
      key => formValues.value[key] !== originalValues.value[key]
    )
  })

  // Validate form values
  function validateForm(): boolean {
    errors.value = {}

    if (options.onValidate) {
      const validationErrors = options.onValidate(formValues.value)
      validationErrors.forEach(error => {
        errors.value[error.field] = error.message
      })
    }

    return Object.keys(errors.value).length === 0
  }

  // Save form values
  async function saveForm(): Promise<boolean> {
    if (!validateForm()) {
      return false
    }

    isSaving.value = true

    try {
      if (options.onSave) {
        await options.onSave(formValues.value)
      } else {
        await defaultSaveHandler()
      }

      // Update original values after successful save
      originalValues.value = { ...formValues.value }
      isDirty.value = false
      return true
    } catch (error) {
      console.error('Failed to save settings:', error)
      return false
    } finally {
      isSaving.value = false
    }
  }

  // Default save handler using the bulk API
  async function defaultSaveHandler() {
    if (!apiUrl) {
      throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured')
    }

    const settingsToUpdate = Object.entries(formValues.value).map(([key, value]) => {
      const setting = settings.find(s => s.key === key)
      return {
        key,
        value,
        type: setting?.type,
        group_id: setting?.group_id,
        description: setting?.description,
        encrypted: setting?.is_encrypted || false
      }
    })

    const response = await fetch(`${apiUrl}/api/settings/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ settings: settingsToUpdate }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || errorData.message || `Failed to save settings: ${response.statusText}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.message || 'Failed to save settings')
    }
  }

  // Reset form to original values
  function resetForm() {
    formValues.value = { ...originalValues.value }
    errors.value = {}
    isDirty.value = false
  }

  // Update a specific field value
  function updateField(key: string, value: string | number | boolean) {
    formValues.value[key] = value
    isDirty.value = hasChanges.value

    // Clear field error when value changes
    if (errors.value[key]) {
      delete errors.value[key]
    }
  }

  // Get field error
  function getFieldError(key: string): string | undefined {
    return errors.value[key]
  }

  // Watch for changes and mark as dirty
  watch(
    () => formValues.value,
    () => {
      isDirty.value = hasChanges.value
    },
    { deep: true }
  )

  // Initialize form values when settings change
  watch(
    () => settings,
    (newSettings) => {
      if (newSettings && newSettings.length > 0) {
        initializeFormValues(newSettings)
      }
    },
    { immediate: true, deep: true }
  )

  return {
    formValues,
    originalValues,
    isSaving,
    errors,
    isDirty,
    hasChanges,
    validateForm,
    saveForm,
    resetForm,
    updateField,
    getFieldError,
    initializeFormValues
  }
}
