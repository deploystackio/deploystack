<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
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
import { Eye } from 'lucide-vue-next'
import type { Team } from './types'

const { t } = useI18n()

interface Props {
  teams: Team[]
  onViewTeam: (teamId: string) => void
}

const props = defineProps<Props>()

// Sort teams by name for consistency
const sortedTeams = computed(() => {
  return [...props.teams].sort((a, b) => {
    return a.name.localeCompare(b.name)
  })
})

// Format date for display
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{{ t('adminTeams.table.columns.name') }}</TableHead>
          <TableHead>{{ t('adminTeams.table.columns.mcpServers') }}</TableHead>
          <TableHead>{{ t('adminTeams.table.columns.members') }}</TableHead>
          <TableHead>{{ t('adminTeams.table.columns.type') }}</TableHead>
          <TableHead>{{ t('adminTeams.table.columns.createdAt') }}</TableHead>
          <TableHead class="w-[100px]">{{ t('adminTeams.table.columns.actions') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <!-- Empty State -->
        <TableRow v-if="sortedTeams.length === 0">
          <TableCell :colspan="6" class="h-24 text-center">
            {{ t('adminTeams.table.noResults') }}
          </TableCell>
        </TableRow>

        <!-- Data Rows -->
        <TableRow v-for="team in sortedTeams" :key="team.id">
          <!-- Name -->
          <TableCell class="font-medium">
            <RouterLink
              :to="`/admin/teams/${team.id}/general`"
              class="hover:underline text-primary"
            >
              {{ team.name }}
            </RouterLink>
          </TableCell>

          <!-- MCP Servers Count -->
          <TableCell>
            <RouterLink
              :to="`/admin/teams/${team.id}/mcp-server`"
              class="text-sm hover:underline text-primary"
            >
              {{ team.mcp_servers_count }}
            </RouterLink>
          </TableCell>

          <!-- Members Count -->
          <TableCell>
            <RouterLink
              :to="`/admin/teams/${team.id}/members`"
              class="text-sm hover:underline text-primary"
            >
              {{ team.members_count }}
            </RouterLink>
          </TableCell>

          <!-- Type (Default/Custom) -->
          <TableCell>
            <Badge
              :variant="team.is_default ? 'default' : 'secondary'"
              class="w-fit"
            >
              {{ team.is_default ? t('adminTeams.table.typeDefault') : t('adminTeams.table.typeCustom') }}
            </Badge>
          </TableCell>

          <!-- Created At -->
          <TableCell>
            <span class="text-sm text-muted-foreground">
              {{ formatDate(team.created_at) }}
            </span>
          </TableCell>

          <!-- Actions -->
          <TableCell>
            <Button
              variant="outline"
              size="sm"
              @click="props.onViewTeam(team.id)"
              class="h-8 px-3"
            >
              <Eye class="h-4 w-4 mr-1" />
              {{ t('adminTeams.table.actions.view') }}
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
