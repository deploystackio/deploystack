<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Badge } from '@/components/ui/badge'
import { DsCard } from '@/components/ui/ds-card'
import type { Team } from '@/views/admin/teams/types'

defineProps<{
  team: Team
}>()

const { t } = useI18n()

// Format date for display
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}
</script>

<template>
  <DsCard :title="t('adminTeams.teamDetail.teamInformation')">
    <p class="text-sm text-muted-foreground mb-6">
      {{ t('adminTeams.teamDetail.teamDetails') }}
    </p>

    <dl class="divide-y divide-gray-100">
      <!-- Team Name -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.name') }}</dt>
        <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
          {{ team.name }}
        </dd>
      </div>

      <!-- Slug -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.slug') }}</dt>
        <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
          <span class="font-mono">{{ team.slug }}</span>
        </dd>
      </div>

      <!-- Description -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.description') }}</dt>
        <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
          {{ team.description || t('adminTeams.teamDetail.values.noDescription') }}
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

      <!-- Team Details -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.teamDetails') }}</dt>
        <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
          <div class="space-y-2">
            <div><span class="font-medium">{{ t('adminTeams.teamDetail.values.teamId') }}</span> <span class="font-mono text-xs">{{ team.id }}</span></div>
            <div><span class="font-medium">{{ t('adminTeams.teamDetail.values.createdAt') }}</span> {{ formatDate(team.created_at) }}</div>
            <div><span class="font-medium">{{ t('adminTeams.teamDetail.values.updatedAt') }}</span> {{ formatDate(team.updated_at) }}</div>
          </div>
        </dd>
      </div>
    </dl>
  </DsCard>
</template>
