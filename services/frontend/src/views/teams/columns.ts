import type { ColumnDef } from '@tanstack/vue-table'
import { h } from 'vue'
import type { TeamWithRole } from '@/services/teamService'

export const createColumns = (): ColumnDef<TeamWithRole>[] => [
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
]
