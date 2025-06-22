import { h } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Mail, Github } from 'lucide-vue-next'
import type { User } from './types'

export const columns: ColumnDef<User>[] = [
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
        h(DropdownMenu, {}, {
          default: () => [
            h(DropdownMenuTrigger, { asChild: true }, () => [
              h(Button, {
                variant: 'ghost',
                class: 'h-8 w-8 p-0'
              }, () => [
                h('span', { class: 'sr-only' }, 'Open menu'),
                h(MoreHorizontal, { class: 'h-4 w-4' })
              ])
            ]),
            h(DropdownMenuContent, { align: 'end' }, () => [
              h(DropdownMenuItem, {
                onClick: () => {
                  // Placeholder for reset password functionality
                  console.log('Reset password for user:', user.id)
                }
              }, () => 'Reset Password')
            ])
          ]
        })
      ])
    },
  },
]
