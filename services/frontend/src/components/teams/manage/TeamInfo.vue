<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Save,
  Lock,
  Calendar,
  Users,
  Hash,
  AlertTriangle
} from 'lucide-vue-next'
import { TeamService, type Team } from '@/services/teamService'
import { z } from 'zod'

const { t } = useI18n()

interface Props {
  team: Team
  canEditName: boolean
  canEditDescription: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  teamUpdated: [team: Team]
}>()

// Form state
const isSaving = ref(false)
const saveError = ref<string | null>(null)

// Form data
const formData = ref({
  name: props.team.name,
  description: props.team.description || ''
})

// Validation schema
const TeamUpdateSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional()
})

// Computed properties
const isDefaultTeam = computed(() => {
  return props.team.is_default === true
})

const hasChanges = computed(() => {
  return formData.value.name !== props.team.name ||
         formData.value.description !== (props.team.description || '')
})

const formattedCreatedDate = computed(() => {
  if (!props.team.created_at) return ''
  return new Date(props.team.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const formattedUpdatedDate = computed(() => {
  if (!props.team.updated_at) return ''
  return new Date(props.team.updated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

// Save team changes
const saveTeam = async () => {
  try {
    isSaving.value = true
    saveError.value = null

    // Validate form data
    const validatedData = TeamUpdateSchema.parse(formData.value)

    // Prepare update data
    const updateData: Partial<Team> = {}

    if (props.canEditName && validatedData.name !== props.team.name) {
      updateData.name = validatedData.name
    }

    if (props.canEditDescription && validatedData.description !== props.team.description) {
      updateData.description = validatedData.description || null
    }

    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      const updatedTeam = await TeamService.updateTeam(props.team.id, updateData)
      emit('teamUpdated', updatedTeam)

      // Show success toast
      toast.success(t('teams.manage.saveSuccess'), {
        description: t('teams.manage.saveSuccessDescription')
      })
    }

  } catch (err) {
    if (err instanceof z.ZodError) {
      saveError.value = err.issues.map(e => e.message).join(', ')
    } else {
      saveError.value = err instanceof Error ? err.message : 'Failed to save team'
    }
    console.error('Error saving team:', err)

    // Show error toast
    toast.error(t('teams.manage.saveError'), {
      description: saveError.value
    })
  } finally {
    isSaving.value = false
  }
}

// Update form data when team prop changes
const updateFormData = () => {
  formData.value = {
    name: props.team.name,
    description: props.team.description || ''
  }
}

// Watch for team changes and update form data
watch(() => props.team, () => {
  updateFormData()
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <!-- Team Information Section -->
    <div>
      <div class="px-4 sm:px-0">
        <h3 class="text-base/7 font-semibold text-gray-900">{{ t('teams.manage.teamDetails') }}</h3>
        <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('teams.manage.teamDetailsDescription') }}</p>
      </div>
      <div class="mt-6 border-t border-gray-100">
        <dl class="divide-y divide-gray-100">
          <!-- Team Name -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
              {{ t('teams.manage.fields.name.label') }}
              <Lock v-if="!canEditName" class="h-3 w-3 text-muted-foreground" />
            </dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <div v-if="canEditName" class="space-y-2">
                <Input
                  v-model="formData.name"
                  :placeholder="t('teams.manage.fields.name.placeholder')"
                  class="max-w-lg"
                />
                <div class="space-y-1">
                  <p v-if="isDefaultTeam" class="text-xs text-muted-foreground flex items-start gap-2">
                    <AlertTriangle class="h-3 w-3 mt-0.5 text-amber-500" />
                    {{ t('teams.manage.fields.name.defaultTeamNote') }}
                  </p>
                </div>
              </div>
              <div v-else class="flex items-center gap-2">
                <span>{{ team.name }}</span>
                <Badge v-if="isDefaultTeam" variant="secondary" class="gap-1">
                  <Users class="h-3 w-3" />
                  {{ t('teams.manage.defaultTeam') }}
                </Badge>
              </div>
              <p v-if="!canEditName" class="text-xs text-muted-foreground flex items-start gap-2 mt-2">
                <Lock class="h-3 w-3 mt-0.5" />
                {{ t('teams.manage.fields.name.noPermission') }}
              </p>
            </dd>
          </div>

          <!-- Team Description -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
              {{ t('teams.manage.fields.description.label') }}
              <Lock v-if="!canEditDescription" class="h-3 w-3 text-muted-foreground" />
            </dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <div v-if="canEditDescription" class="space-y-2">
                <textarea
                  v-model="formData.description"
                  :placeholder="t('teams.manage.fields.description.placeholder')"
                  class="flex min-h-[100px] w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  rows="4"
                />
              </div>
              <div v-else>
                {{ team.description || t('teams.manage.fields.description.noDescription') }}
              </div>
              <p v-if="!canEditDescription" class="text-xs text-muted-foreground flex items-start gap-2 mt-2">
                <Lock class="h-3 w-3 mt-0.5" />
                {{ t('teams.manage.fields.description.noPermission') }}
              </p>
            </dd>
          </div>

          <!-- Team ID -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
              <Hash class="h-4 w-4 text-muted-foreground" />
              {{ t('teams.manage.teamId') }}
            </dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <span class="font-mono text-xs">{{ team.id }}</span>
            </dd>
          </div>

          <!-- Team Information -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900">{{ t('teams.manage.teamInfo') }}</dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <div class="space-y-2">
                <div class="flex items-center gap-1">
                  <Calendar class="h-4 w-4 text-muted-foreground" />
                  <span class="font-medium">{{ t('teams.manage.created') }}</span> {{ formattedCreatedDate }}
                </div>
                <div class="flex items-center gap-1">
                  <Calendar class="h-4 w-4 text-muted-foreground" />
                  <span class="font-medium">{{ t('teams.manage.updated') }}</span> {{ formattedUpdatedDate }}
                </div>
                <div v-if="isDefaultTeam" class="flex items-center gap-1">
                  <Users class="h-4 w-4 text-muted-foreground" />
                  <span class="font-medium">{{ t('teams.manage.status') }}</span>
                  <Badge variant="secondary" class="gap-1">
                    <Users class="h-3 w-3" />
                    {{ t('teams.manage.defaultTeam') }}
                  </Badge>
                </div>
              </div>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Form Actions -->
    <div class="flex items-center justify-end pt-4 border-t">
      <Button
        @click="saveTeam"
        :disabled="!hasChanges"
        :loading="isSaving"
        :loading-text="t('teams.manage.saving')"
        class="gap-2"
      >
        <Save class="h-4 w-4" />
        {{ t('teams.manage.save') }}
      </Button>
    </div>
  </div>
</template>
