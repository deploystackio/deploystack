<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { DsCard } from '@/components/ui/ds-card'
import { TeamService } from '@/services/teamService'
import type { Team } from '@/views/admin/teams/types'

const props = defineProps<{
  team: Team
}>()

const emit = defineEmits<{
  updated: [team: Team]
}>()

const { t } = useI18n()

// Form state for name
const nameValue = ref(props.team.name)
const nameError = ref<string | null>(null)
const isNameSaving = ref(false)

// Form state for description
const descriptionValue = ref(props.team.description || '')
const descriptionError = ref<string | null>(null)
const isDescriptionSaving = ref(false)

// Watch for team prop changes
watch(() => props.team, (newTeam) => {
  nameValue.value = newTeam.name
  descriptionValue.value = newTeam.description || ''
}, { deep: true })

// Format date for display
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

// Save team name
const saveName = async () => {
  nameError.value = null

  // Validate
  if (!nameValue.value || nameValue.value.trim().length === 0) {
    nameError.value = t('adminTeams.teamEdit.form.nameRequired')
    return
  }
  if (nameValue.value.length > 100) {
    nameError.value = t('adminTeams.teamEdit.form.nameMaxLength')
    return
  }

  // Skip if unchanged
  if (nameValue.value === props.team.name) {
    return
  }

  try {
    isNameSaving.value = true
    const updatedTeam = await TeamService.updateTeamAsAdmin(props.team.id, {
      name: nameValue.value
    })
    toast.success(t('adminTeams.teamEdit.success'))
    emit('updated', updatedTeam)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    toast.error(t('adminTeams.teamEdit.error', { error: errorMessage }))
  } finally {
    isNameSaving.value = false
  }
}

// Save team description
const saveDescription = async () => {
  descriptionError.value = null

  // Validate
  if (descriptionValue.value && descriptionValue.value.length > 500) {
    descriptionError.value = t('adminTeams.teamEdit.form.descriptionMaxLength')
    return
  }

  // Skip if unchanged
  const currentDescription = props.team.description || ''
  if (descriptionValue.value === currentDescription) {
    return
  }

  try {
    isDescriptionSaving.value = true
    const updatedTeam = await TeamService.updateTeamAsAdmin(props.team.id, {
      description: descriptionValue.value || null
    })
    toast.success(t('adminTeams.teamEdit.success'))
    emit('updated', updatedTeam)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    toast.error(t('adminTeams.teamEdit.error', { error: errorMessage }))
  } finally {
    isDescriptionSaving.value = false
  }
}
</script>

<template>
  <!-- Team Name Card -->
  <DsCard :title="t('adminTeams.teamEdit.form.name')">
    <p class="text-sm text-muted-foreground mb-4">
      This is the team's display name within DeployStack.
    </p>
    <Input
      v-model="nameValue"
      :placeholder="t('adminTeams.teamEdit.form.namePlaceholder')"
      :disabled="isNameSaving"
      :class="{ 'border-red-500': nameError }"
    />
    <p v-if="nameError" class="text-sm text-red-500 mt-2">
      {{ nameError }}
    </p>

    <template #footer-status>
      {{ t('adminTeams.teamEdit.form.nameMaxLength') }}
    </template>

    <template #footer-actions>
      <Button :disabled="isNameSaving || nameValue === team.name" @click="saveName">
        <Spinner v-if="isNameSaving" class="mr-2" />
        {{ t('adminTeams.teamEdit.form.submit') }}
      </Button>
    </template>
  </DsCard>

  <!-- Team Description Card -->
  <DsCard :title="t('adminTeams.teamEdit.form.description')" class="mt-6">
    <p class="text-sm text-muted-foreground mb-4">
      A brief description of the team's purpose.
    </p>
    <Textarea
      v-model="descriptionValue"
      :placeholder="t('adminTeams.teamEdit.form.descriptionPlaceholder')"
      :disabled="isDescriptionSaving"
      :class="{ 'border-red-500': descriptionError }"
      rows="4"
    />
    <p v-if="descriptionError" class="text-sm text-red-500 mt-2">
      {{ descriptionError }}
    </p>

    <template #footer-status>
      {{ t('adminTeams.teamEdit.form.descriptionMaxLength') }}
    </template>

    <template #footer-actions>
      <Button :disabled="isDescriptionSaving || descriptionValue === (team.description || '')" @click="saveDescription">
        <Spinner v-if="isDescriptionSaving" class="mr-2" />
        {{ t('adminTeams.teamEdit.form.submit') }}
      </Button>
    </template>
  </DsCard>

  <!-- Team Details Card (Read-only) -->
  <DsCard :title="t('adminTeams.teamDetail.fields.teamDetails')" class="mt-6">
    <dl class="divide-y divide-gray-100">
      <!-- Slug -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.slug') }}</dt>
        <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
          <span class="font-mono">{{ team.slug }}</span>
        </dd>
      </div>

      <!-- Type -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.type') }}</dt>
        <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
          <Badge
            :variant="team.is_default ? 'default' : 'secondary'"
            class="w-fit"
          >
            {{ team.is_default ? t('adminTeams.table.typeDefault') : t('adminTeams.table.typeCustom') }}
          </Badge>
        </dd>
      </div>

      <!-- Team ID -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm font-medium text-gray-900">{{ t('adminTeams.teamDetail.values.teamId') }}</dt>
        <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
          <span class="font-mono text-xs">{{ team.id }}</span>
        </dd>
      </div>

      <!-- Created At -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm font-medium text-gray-900">{{ t('adminTeams.teamDetail.values.createdAt') }}</dt>
        <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
          {{ formatDate(team.created_at) }}
        </dd>
      </div>

      <!-- Updated At -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm font-medium text-gray-900">{{ t('adminTeams.teamDetail.values.updatedAt') }}</dt>
        <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
          {{ formatDate(team.updated_at) }}
        </dd>
      </div>
    </dl>
  </DsCard>
</template>
