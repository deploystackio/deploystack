import type { ColumnDef } from '@tanstack/vue-table'
import { h } from 'vue'
import { Button } from '@/components/ui/button'
import { Settings, ArrowRightLeft } from 'lucide-vue-next'
import type { TeamWithRole } from '@/services/teamService'

export const createColumns = (
  onManageTeam: (teamId: string) => void,
  onSwitchTeam: (teamId: string) => void,
  selectedTeamId: string | null,
  userPermissions: string[] = []
): ColumnDef<TeamWithRole>[] => [
  {
    accessorKey: 'name',
    header: 'Team Name',
    cell: ({ row }) => {
      const team = row.original
      return h('div', { class: 'font-medium' }, team.name)
    },
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => {
      const team = row.original
      return h('div', { class: 'text-muted-foreground' },
        team.description || 'No description'
      )
    },
  },
  {
    accessorKey: 'role',
    header: 'Your Role',
    cell: ({ row }) => {
      const team = row.original
      const roleDisplay = team.role === 'team_admin' ? 'Admin' : 'User'
      const roleClass = team.role === 'team_admin'
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'

      return h('span', {
        class: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleClass}`
      }, roleDisplay)
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => {
      const team = row.original
      const date = new Date(team.created_at)
      return h('div', { class: 'text-sm text-muted-foreground' },
        date.toLocaleDateString()
      )
    },
  },
  {
    id: 'switch',
    header: 'Switch Team',
    enableHiding: false,
    cell: ({ row }) => {
      const team = row.original
      const isSelected = selectedTeamId === team.id

      return h('div', { class: 'flex justify-start' }, [
        h(Button, {
          variant: isSelected ? 'default' : 'outline',
          size: 'sm',
          class: 'h-8 px-3',
          disabled: isSelected,
          onClick: () => {
            if (!isSelected) {
              onSwitchTeam(team.id)
            }
          }
        }, () => [
          h(ArrowRightLeft, { class: 'h-4 w-4 mr-1' }),
          isSelected ? 'Selected' : 'Switch'
        ])
      ])
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    enableHiding: false,
    cell: ({ row }) => {
      const team = row.original

      // Check if user can manage this team
      const canManage = userPermissions.includes('teams.edit') &&
                       team.role === 'team_admin'

      if (!canManage) {
        return h('div', { class: 'text-muted-foreground text-sm' }, 'No actions')
      }

      return h('div', { class: 'flex justify-end' }, [
        h(Button, {
          variant: 'outline',
          size: 'sm',
          class: 'h-8 px-3',
          onClick: () => {
            onManageTeam(team.id)
          }
        }, () => [
          h(Settings, { class: 'h-4 w-4 mr-1' }),
          'Manage'
        ])
      ])
    },
  },
]
