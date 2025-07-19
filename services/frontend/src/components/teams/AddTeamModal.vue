<script setup lang="ts">
import { ref, computed } from 'vue'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TeamService, CreateTeamSchema, type CreateTeamInput } from '@/services/teamService'
import { useEventBus } from '@/composables/useEventBus'

interface Props {
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'teamCreated', teamData: { name: string }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()
const eventBus = useEventBus()

// Form state
const formData = ref<CreateTeamInput>({
  name: '',
  description: ''
})

const isSubmitting = ref(false)
const errors = ref<Record<string, string>>({})

// Computed properties
const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const isFormValid = computed(() => {
  return formData.value.name.trim().length > 0 && Object.keys(errors.value).length === 0
})

// Validation
const validateForm = () => {
  errors.value = {}

  try {
    CreateTeamSchema.parse(formData.value)
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.issues.forEach((err) => {
        if (err.path.length > 0) {
          errors.value[err.path[0] as string] = err.message
        }
      })
    }
  }
}

// Form handlers
const handleSubmit = async () => {
  validateForm()

  if (!isFormValid.value) {
    return
  }

  isSubmitting.value = true

  try {
    const teamName = formData.value.name
    await TeamService.createTeam(formData.value)

    // Emit global event for immediate UI updates across components
    eventBus.emit('teams-updated')

    // Close modal and emit success with team data
    isOpen.value = false
    emit('teamCreated', { name: teamName })

    // Reset form after successful creation
    formData.value = { name: '', description: '' }
    errors.value = {}
  } catch (error) {
    console.error('Error creating team:', error)

    // Handle specific error messages
    if (error instanceof Error) {
      if (error.message.includes('limit')) {
        errors.value.general = t('teams.addModal.errors.limitReached')
      } else if (error.message.includes('permission')) {
        errors.value.general = t('teams.addModal.errors.noPermission')
      } else {
        errors.value.general = error.message
      }
    } else {
      errors.value.general = t('teams.addModal.errors.unknown')
    }
  } finally {
    isSubmitting.value = false
  }
}

const handleCancel = () => {
  // Reset form
  formData.value = { name: '', description: '' }
  errors.value = {}
  isOpen.value = false
}

// Watch for form changes to validate
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
</script>

<template>
  <AlertDialog :open="isOpen" @update:open="(value) => isOpen = value">
    <AlertDialogContent class="sm:max-w-[425px]">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('teams.addModal.title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('teams.addModal.description') }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- General Error -->
        <div v-if="errors.general" class="text-sm text-destructive">
          {{ errors.general }}
        </div>

        <!-- Team Name -->
        <div class="space-y-2">
          <Label for="team-name">{{ t('teams.addModal.fields.name.label') }}</Label>
          <Input
            id="team-name"
            v-model="formData.name"
            :placeholder="t('teams.addModal.fields.name.placeholder')"
            :class="{ 'border-destructive': errors.name }"
            @input="handleNameChange"
            required
          />
          <div v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </div>
        </div>

        <!-- Team Description -->
        <div class="space-y-2">
          <Label for="team-description">{{ t('teams.addModal.fields.description.label') }}</Label>
          <textarea
            id="team-description"
            v-model="formData.description"
            :placeholder="t('teams.addModal.fields.description.placeholder')"
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

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="handleCancel"
            :disabled="isSubmitting"
          >
            {{ t('teams.addModal.buttons.cancel') }}
          </Button>
          <Button
            type="submit"
            :disabled="!isFormValid || isSubmitting"
          >
            {{ isSubmitting ? t('teams.addModal.buttons.creating') : t('teams.addModal.buttons.create') }}
          </Button>
        </AlertDialogFooter>
      </form>
    </AlertDialogContent>
  </AlertDialog>
</template>
