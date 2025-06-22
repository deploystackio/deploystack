import { h } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Github, Eye } from 'lucide-vue-next'
import type { User } from './types'

export function createColumns(onViewUser: (userId: string) => void): ColumnDef<User>[] {
  return [
  {
    accessorKey: 'auth_type',
    header: 'Registration',
    cell: ({ row }) => {
      const authType = row.getValue('auth_type') as string
      const isEmail = authType === 'email_signup'
      
      return h('div', { class: 'flex items-center gap-2' }, [
        h(Badge, {
          variant: isEmail ? 'default' : 'secondary',
          class: 'flex items-center gap-1'
        }, () => [
          isEmail 
            ? h(Mail, { class: 'h-3 w-3' })
            : h(Github, { class: 'h-3 w-3' }),
          isEmail ? 'Email' : 'GitHub'
        ])
      ])
    },
  },
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const user = row.original
      const firstName = user.first_name || ''
      const lastName = user.last_name || ''
      const fullName = `${firstName} ${lastName}`.trim()
      
      return h('div', { class: 'font-medium' }, 
        fullName || user.username
      )
    },
  },
  {
    id: 'email_username',
    header: 'Email',
    cell: ({ row }) => {
      const user = row.original
      return h('div', { class: 'font-mono text-sm' }, 
        `${user.email} (${user.username})`
      )
    },
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => {
      const role = row.original.role
      return h('div', {},
        role ? role.name : 'No Role'
      )
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const user = row.original
      
      return h('div', { class: 'flex justify-end' }, [
        h(Button, {
          variant: 'outline',
          size: 'sm',
          class: 'h-8 px-3',
          onClick: () => {
            onViewUser(user.id)
          }
        }, () => [
          h(Eye, { class: 'h-4 w-4 mr-1' }),
          'View User'
        ])
      ])
    },
  },
  ]
}
