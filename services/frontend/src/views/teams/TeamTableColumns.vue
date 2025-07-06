<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Settings, ArrowRightLeft } from 'lucide-vue-next'
import type { TeamWithRole } from '@/services/teamService'

interface Props {
  teams: TeamWithRole[]
  selectedTeamId: string | null
  userPermissions: string[]
  onManageTeam: (teamId: string) => void
  onSwitchTeam: (teamId: string) => void
}

const props = defineProps<Props>()
const { t } = useI18n()

// Helper function to check if user can manage a specific team
const canManageTeam = (team: TeamWithRole): boolean => {
  return props.userPermissions.includes('teams.edit') && team.role === 'team_admin'
}

// Helper function to format date
const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString()
}

// Helper function to get role display info
const getRoleDisplay = (role: string) => {
  const isAdmin = role === 'team_admin'
  return {
    text: isAdmin ? 'Admin' : 'User',
    class: isAdmin
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}
</script>

<template>
  <div class="rounded-md border">
    <table class="w-full">
      <thead>
        <tr class="border-b bg-muted/50">
          <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
            {{ t('teams.table.columns.name') }}
          </th>
          <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
            {{ t('teams.table.columns.description') }}
          </th>
          <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
            {{ t('teams.table.columns.role') }}
          </th>
          <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
            {{ t('teams.table.columns.created') }}
          </th>
          <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
            {{ t('teams.table.columns.switch') }}
          </th>
          <th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
            {{ t('teams.table.columns.actions') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="team in teams"
          :key="team.id"
          class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
        >
          <!-- Team Name -->
          <td class="p-4 align-middle">
            <div class="font-medium">{{ team.name }}</div>
          </td>

          <!-- Description -->
          <td class="p-4 align-middle">
            <div class="text-muted-foreground">
              {{ team.description || t('teams.table.noDescription') }}
            </div>
          </td>

          <!-- Role -->
          <td class="p-4 align-middle">
            <Badge
              :class="getRoleDisplay(team.role).class"
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            >
              {{ getRoleDisplay(team.role).text }}
            </Badge>
          </td>

          <!-- Created Date -->
          <td class="p-4 align-middle">
            <div class="text-sm text-muted-foreground">
              {{ formatDate(team.created_at) }}
            </div>
          </td>

          <!-- Switch Team -->
          <td class="p-4 align-middle">
            <div class="flex justify-start">
              <Button
                :variant="selectedTeamId === team.id ? 'default' : 'outline'"
                size="sm"
                class="h-8 px-3"
                :disabled="selectedTeamId === team.id"
                @click="() => {
                  if (selectedTeamId !== team.id) {
                    props.onSwitchTeam(team.id)
                  }
                }"
              >
                <ArrowRightLeft class="h-4 w-4 mr-1" />
                {{ selectedTeamId === team.id ? t('teams.table.selected') : t('teams.table.switch') }}
              </Button>
            </div>
          </td>

          <!-- Actions -->
          <td class="p-4 align-middle">
            <div class="flex justify-end">
              <Button
                v-if="canManageTeam(team)"
                variant="outline"
                size="sm"
                class="h-8 px-3"
                @click="() => props.onManageTeam(team.id)"
              >
                <Settings class="h-4 w-4 mr-1" />
                {{ t('teams.table.manage') }}
              </Button>
              <div
                v-else
                class="text-muted-foreground text-sm"
              >
                {{ t('teams.table.noActions') }}
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
