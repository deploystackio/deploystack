<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-vue-next'
import { CredentialsService } from '@/services/credentialsService'
import type { CloudProvider, CreateCredentialInput } from '@/types/credentials'

interface Props {
  open: boolean
  teamId?: string
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'credential-created'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

// State
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref<string | null>(null)
const providers = ref<CloudProvider[]>([])
const selectedProviderId = ref<string>('')
const credentialName = ref('')
const credentialComment = ref('')
const credentialFields = ref<Record<string, string>>({})
const fieldVisibility = ref<Record<string, boolean>>({})
const validationErrors = ref<Record<string, string>>({})

// Computed
const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const selectedProvider = computed(() => {
  return providers.value.find(p => p.id === selectedProviderId.value) || null
})

const isFormValid = computed(() => {
  if (!selectedProviderId.value || !credentialName.value.trim()) {
    return false
  }

  if (!selectedProvider.value) return false

  // Check if all required fields are filled
  for (const field of selectedProvider.value.fields) {
    if (field.required && !credentialFields.value[field.key]?.trim()) {
      return false
    }
  }

  return Object.keys(validationErrors.value).length === 0
})

// Methods
const handleClose = () => {
  resetForm()
  isOpen.value = false
}

const resetForm = () => {
  selectedProviderId.value = ''
  credentialName.value = ''
  credentialComment.value = ''
  credentialFields.value = {}
  fieldVisibility.value = {}
  validationErrors.value = {}
  error.value = null
}

const loadProviders = async () => {
  if (!props.teamId) return

  try {
    isLoading.value = true
    error.value = null
    providers.value = await CredentialsService.getCloudProviders(props.teamId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load providers'
    console.error('Error loading providers:', err)
  } finally {
    isLoading.value = false
  }
}

const validateField = (fieldKey: string, value: string) => {
  if (!selectedProvider.value) return

  const field = selectedProvider.value.fields.find(f => f.key === fieldKey)
  if (!field) return

  const errors: string[] = []

  // Required validation
  if (field.required && !value.trim()) {
    errors.push(t('credentials.form.validation.required'))
  }

  // Skip other validations if field is empty and not required
  if (!value.trim() && !field.required) {
    delete validationErrors.value[fieldKey]
    return
  }

  // Length validations
  if (field.validation?.minLength && value.length < field.validation.minLength) {
    errors.push(t('credentials.form.validation.minLength', {
      field: field.label,
      min: field.validation.minLength
    }))
  }

  if (field.validation?.maxLength && value.length > field.validation.maxLength) {
    errors.push(t('credentials.form.validation.maxLength', {
      field: field.label,
      max: field.validation.maxLength
    }))
  }

  // Pattern validation
  if (field.validation?.pattern && value.trim()) {
    try {
      const regex = new RegExp(field.validation.pattern)
      if (!regex.test(value)) {
        errors.push(t('credentials.form.validation.pattern', { field: field.label }))
      }
    } catch {
      console.warn('Invalid regex pattern for field:', fieldKey, field.validation.pattern)
    }
  }

  if (errors.length > 0) {
    validationErrors.value[fieldKey] = errors[0]
  } else {
    delete validationErrors.value[fieldKey]
  }
}

const validateCredentialName = () => {
  const errors: string[] = []

  if (!credentialName.value.trim()) {
    errors.push(t('credentials.form.fields.name.required'))
  } else if (credentialName.value.length > 100) {
    errors.push(t('credentials.form.fields.name.maxLength'))
  }

  if (errors.length > 0) {
    validationErrors.value['name'] = errors[0]
  } else {
    delete validationErrors.value['name']
  }
}

const validateComment = () => {
  if (credentialComment.value.length > 500) {
    validationErrors.value['comment'] = t('credentials.form.fields.comment.maxLength')
  } else {
    delete validationErrors.value['comment']
  }
}

const toggleFieldVisibility = (fieldKey: string) => {
  fieldVisibility.value[fieldKey] = !fieldVisibility.value[fieldKey]
}

const handleSubmit = async () => {
  if (!props.teamId || !selectedProvider.value || !isFormValid.value) return

  try {
    isSaving.value = true
    error.value = null

    // Prepare credential data
    const credentialData: CreateCredentialInput = {
      providerId: selectedProviderId.value,
      name: credentialName.value.trim(),
      comment: credentialComment.value.trim() || undefined,
      credentials: { ...credentialFields.value }
    }

    // Create the credential
    await CredentialsService.createCredential(props.teamId, credentialData)

    // Emit success event
    emit('credential-created')

    // Close dialog
    handleClose()

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create credential'
    console.error('Error creating credential:', err)
  } finally {
    isSaving.value = false
  }
}

// Watch for provider changes to reset fields
watch(selectedProviderId, (newProviderId) => {
  credentialFields.value = {}
  fieldVisibility.value = {}
  validationErrors.value = {}

  if (newProviderId && selectedProvider.value) {
    // Initialize field visibility for secret fields
    selectedProvider.value.fields.forEach(field => {
      if (field.secret) {
        fieldVisibility.value[field.key] = false
      }
    })
  }
})

// Watch for field changes to validate
watch(credentialFields, (newFields) => {
  Object.keys(newFields).forEach(fieldKey => {
    validateField(fieldKey, newFields[fieldKey])
  })
}, { deep: true })

// Watch for name and comment changes
watch(credentialName, validateCredentialName)
watch(credentialComment, validateComment)

// Load providers when dialog opens
watch(() => props.open, (isOpen) => {
  if (isOpen && props.teamId) {
    loadProviders()
  }
})

onMounted(() => {
  if (props.open && props.teamId) {
    loadProviders()
  }
})
</script>

<template>
  <!-- Modal Overlay -->
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/50"
      @click="handleClose"
    ></div>

    <!-- Modal Content -->
    <Card class="relative z-10 w-full max-w-[600px] mx-4 p-6 max-h-[90vh] overflow-y-auto">
      <div class="space-y-6">
        <!-- Header -->
        <div>
          <h2 class="text-lg font-semibold">{{ t('credentials.form.title.add') }}</h2>
          <p class="text-sm text-muted-foreground">
            {{ t('credentials.description') }}
          </p>
        </div>

        <!-- Error Alert -->
        <Alert v-if="error" variant="destructive">
          <AlertCircle class="h-4 w-4" />
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <!-- Loading State -->
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <Loader2 class="h-6 w-6 animate-spin" />
          <span class="ml-2">{{ t('credentials.providers.loading') }}</span>
        </div>

        <!-- Form -->
        <form v-else @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Provider Selection -->
          <div class="space-y-2">
            <Label for="provider">{{ t('credentials.form.fields.provider.label') }}</Label>
            <Select v-model="selectedProviderId">
              <SelectTrigger>
                <SelectValue :placeholder="t('credentials.form.fields.provider.placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="provider in providers"
                  :key="provider.id"
                  :value="provider.id"
                >
                  {{ provider.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="validationErrors.provider" class="text-sm text-destructive">
              {{ validationErrors.provider }}
            </p>
          </div>

          <!-- Credential Name -->
          <div class="space-y-2">
            <Label for="name">{{ t('credentials.form.fields.name.label') }}</Label>
            <Input
              id="name"
              v-model="credentialName"
              :placeholder="t('credentials.form.fields.name.placeholder')"
              :class="validationErrors.name ? 'border-destructive' : ''"
            />
            <p v-if="validationErrors.name" class="text-sm text-destructive">
              {{ validationErrors.name }}
            </p>
          </div>

          <!-- Comment (Optional) -->
          <div class="space-y-2">
            <Label for="comment">{{ t('credentials.form.fields.comment.label') }}</Label>
            <Input
              id="comment"
              v-model="credentialComment"
              :placeholder="t('credentials.form.fields.comment.placeholder')"
              :class="validationErrors.comment ? 'border-destructive' : ''"
            />
            <p v-if="validationErrors.comment" class="text-sm text-destructive">
              {{ validationErrors.comment }}
            </p>
          </div>

          <!-- Dynamic Provider Fields -->
          <div v-if="selectedProvider" class="space-y-4">
            <div class="border-t pt-4">
              <h3 class="text-sm font-medium mb-3">{{ selectedProvider.name }} Configuration</h3>

              <div
                v-for="field in selectedProvider.fields"
                :key="field.key"
                class="space-y-2"
              >
                <Label :for="field.key">
                  {{ field.label }}
                  <span v-if="field.required" class="text-destructive">*</span>
                </Label>

                <div class="relative">
                  <Input
                    :id="field.key"
                    v-model="credentialFields[field.key]"
                    :type="field.secret && !fieldVisibility[field.key] ? 'password' : 'text'"
                    :placeholder="field.placeholder"
                    :class="validationErrors[field.key] ? 'border-destructive' : ''"
                    class="pr-10"
                  />

                  <!-- Toggle visibility for secret fields -->
                  <button
                    v-if="field.secret"
                    type="button"
                    @click="toggleFieldVisibility(field.key)"
                    class="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Eye v-if="!fieldVisibility[field.key]" class="h-4 w-4" />
                    <EyeOff v-else class="h-4 w-4" />
                  </button>
                </div>

                <p v-if="field.description" class="text-xs text-muted-foreground">
                  {{ field.description }}
                </p>

                <p v-if="validationErrors[field.key]" class="text-sm text-destructive">
                  {{ validationErrors[field.key] }}
                </p>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" @click="handleClose" :disabled="isSaving">
              {{ t('credentials.form.buttons.cancel') }}
            </Button>
            <Button
              type="submit"
              :disabled="!isFormValid || isSaving"
              class="min-w-[120px]"
            >
              <Loader2 v-if="isSaving" class="h-4 w-4 animate-spin mr-2" />
              {{ isSaving ? t('credentials.form.buttons.saving') : t('credentials.form.buttons.save') }}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  </div>
</template>
