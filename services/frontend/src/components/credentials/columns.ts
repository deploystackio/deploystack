import { h } from 'vue'
import type { ColumnDef, Row } from '@tanstack/vue-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Trash2 } from 'lucide-vue-next'
import type { CloudCredential, CloudCredentialBasic } from '@/types/credentials'

export function createColumns(
  handleEdit: (credentialId: string) => void,
  handleDelete: (credentialId: string) => void,
  userPermissions: string[]
): ColumnDef<CloudCredential | CloudCredentialBasic>[] {
  const canEdit = userPermissions.includes('cloud_credentials.edit')
  const canDelete = userPermissions.includes('cloud_credentials.delete')
  const showActions = canEdit || canDelete

  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const name = row.getValue('name') as string
        return h('div', { class: 'font-medium' }, name)
      },
    },
    {
      accessorKey: 'provider',
      header: 'Provider',
      cell: ({ row }) => {
        const provider = row.getValue('provider') as { id: string; name: string }

        return h('div', { class: 'flex items-center gap-2' }, [
          // Provider SVG icon
          h('img', {
            src: `/images/provider/${provider.id}.svg`,
            alt: provider.name,
            class: 'w-5 h-5',
            onError: (event: Event) => {
              // Hide broken image on error
              const img = event.target as HTMLImageElement
              img.style.display = 'none'
            }
          }),
          // Provider badge
          h(Badge, { variant: 'secondary' }, () => provider.name)
        ])
      },
    },
    {
      accessorKey: 'comment',
      header: 'Comment',
      cell: ({ row }) => {
        const comment = row.getValue('comment') as string | null
        return h('div', {
          class: comment ? 'text-sm' : 'text-sm text-muted-foreground italic'
        }, comment || 'No comment')
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => {
        const createdAt = row.getValue('createdAt') as string
        const date = new Date(createdAt)
        return h('div', { class: 'text-sm text-muted-foreground' },
          date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        )
      },
    },
    ...(showActions ? [{
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: { row: Row<CloudCredential | CloudCredentialBasic> }) => {
        const credential = row.original

        return h('div', { class: 'flex justify-end' }, [
          h(DropdownMenu, {}, {
            default: () => [
              h(DropdownMenuTrigger, { asChild: true }, {
                default: () => h(Button, {
                  variant: 'ghost',
                  class: 'h-8 w-8 p-0'
                }, {
                  default: () => [
                    h('span', { class: 'sr-only' }, 'Open menu'),
                    h(MoreHorizontal, { class: 'h-4 w-4' })
                  ]
                })
              }),
              h(DropdownMenuContent, { align: 'end' }, {
                default: () => [
                  ...(canEdit ? [
                    h(DropdownMenuItem, {
                      onClick: () => handleEdit(credential.id)
                    }, {
                      default: () => [
                        h(Edit, { class: 'mr-2 h-4 w-4' }),
                        'Edit'
                      ]
                    })
                  ] : []),
                  ...(canDelete ? [
                    h(DropdownMenuItem, {
                      onClick: () => handleDelete(credential.id),
                      class: 'text-destructive focus:text-destructive'
                    }, {
                      default: () => [
                        h(Trash2, { class: 'mr-2 h-4 w-4' }),
                        'Delete'
                      ]
                    })
                  ] : [])
                ]
              })
            ]
          })
        ])
      },
    }] : [])
  ]
}
