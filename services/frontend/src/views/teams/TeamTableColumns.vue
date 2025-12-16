<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Settings, ArrowRightLeft } from 'lucide-vue-next'
import type { TeamWithRole } from '@/services/teamService'

interface Props {
  teams: TeamWithRole[]
  selectedTeamId: string | null
  userPermissions: string[]
  isLoading?: boolean
  onManageTeam: (teamId: string) => void
  onSwitchTeam: (teamId: string) => void
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false
})
const { t } = useI18n()

// Sort teams by name for consistency
const sortedTeams = computed(() => {
  return [...props.teams].sort((a, b) => a.name.localeCompare(b.name))
})

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
    variant: (isAdmin ? 'default' : 'secondary') as 'default' | 'secondary'
  }
}
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{{ t('teams.table.columns.name') }}</TableHead>
          <TableHead>{{ t('teams.table.columns.description') }}</TableHead>
          <TableHead>{{ t('teams.table.columns.role') }}</TableHead>
          <TableHead>{{ t('teams.table.columns.created') }}</TableHead>
          <TableHead>{{ t('teams.table.columns.switch') }}</TableHead>
          <TableHead class="w-[100px]">{{ t('teams.table.columns.actions') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <!-- Loading State -->
        <TableRow v-if="isLoading" v-for="i in 3" :key="`skeleton-${i}`">
          <TableCell><Skeleton class="h-4 w-32" /></TableCell>
          <TableCell><Skeleton class="h-4 w-48" /></TableCell>
          <TableCell><Skeleton class="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton class="h-4 w-24" /></TableCell>
          <TableCell><Skeleton class="h-8 w-24" /></TableCell>
          <TableCell><Skeleton class="h-8 w-20" /></TableCell>
        </TableRow>

        <!-- Empty State -->
        <TableRow v-else-if="sortedTeams.length === 0">
          <TableCell :colspan="6" class="h-24 text-center">
            {{ t('teams.table.noResults') }}
          </TableCell>
        </TableRow>

        <!-- Data Rows -->
        <TableRow
          v-else
          v-for="team in sortedTeams"
          :key="team.id"
          :class="{ 'bg-muted/50': selectedTeamId === team.id }"
        >
          <!-- Team Name -->
          <TableCell class="font-medium">
            {{ team.name }}
          </TableCell>

          <!-- Description -->
          <TableCell>
            <span v-if="team.description" class="text-sm text-muted-foreground">
              {{ team.description }}
            </span>
            <span v-else class="text-sm text-muted-foreground italic">
              {{ t('teams.table.noDescription') }}
            </span>
          </TableCell>

          <!-- Role -->
          <TableCell>
            <Badge :variant="getRoleDisplay(team.role).variant">
              {{ getRoleDisplay(team.role).text }}
            </Badge>
          </TableCell>

          <!-- Created Date -->
          <TableCell class="text-sm text-muted-foreground">
            {{ formatDate(team.created_at) }}
          </TableCell>

          <!-- Switch Team -->
          <TableCell>
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
          </TableCell>

          <!-- Actions -->
          <TableCell>
            <div class="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                class="h-8 px-3"
                @click="() => props.onManageTeam(team.id)"
              >
                <Settings class="h-4 w-4 mr-1" />
                {{ t('teams.table.manage') }}
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
