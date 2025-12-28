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
import { Mail, Github, Eye } from 'lucide-vue-next'
import type { User } from '@/views/admin/users/types'

const { t } = useI18n()

interface Props {
  users: User[]
  onViewUser: (userId: string) => void
}

const props = defineProps<Props>()

// Sort users by name for consistency
const sortedUsers = computed(() => {
  return [...props.users].sort((a, b) => {
    const nameA = getDisplayName(a)
    const nameB = getDisplayName(b)
    return nameA.localeCompare(nameB)
  })
})

// Get display name for user
const getDisplayName = (user: User) => {
  const firstName = user.first_name || ''
  const lastName = user.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || user.username
}

// Get auth type badge variant and icon
const getAuthTypeInfo = (authType: string) => {
  const isEmail = authType === 'email_signup'
  return {
    variant: (isEmail ? 'default' : 'secondary') as 'default' | 'secondary',
    icon: isEmail ? Mail : Github,
    label: isEmail ? 'Email' : 'GitHub'
  }
}
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{{ t('adminUsers.table.columns.registration') }}</TableHead>
          <TableHead>{{ t('adminUsers.table.columns.name') }}</TableHead>
          <TableHead>{{ t('adminUsers.table.columns.email') }}</TableHead>
          <TableHead>{{ t('adminUsers.table.columns.role') }}</TableHead>
          <TableHead class="w-[100px]">{{ t('adminUsers.table.columns.actions') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <!-- Empty State -->
        <TableRow v-if="sortedUsers.length === 0">
          <TableCell :colspan="5" class="h-24 text-center">
            {{ t('adminUsers.table.noResults') }}
          </TableCell>
        </TableRow>

        <!-- Data Rows -->
        <TableRow v-for="user in sortedUsers" :key="user.id">
          <!-- Registration Type -->
          <TableCell>
            <Badge
              :variant="getAuthTypeInfo(user.auth_type).variant"
              class="flex items-center gap-1 w-fit"
            >
              <component
                :is="getAuthTypeInfo(user.auth_type).icon"
                class="h-3 w-3"
              />
              {{ getAuthTypeInfo(user.auth_type).label }}
            </Badge>
          </TableCell>

          <!-- Name -->
          <TableCell class="font-medium">
            {{ getDisplayName(user) }}
          </TableCell>

          <!-- Email -->
          <TableCell>
            <div class="font-mono text-sm">
              {{ user.email }} ({{ user.username }})
            </div>
          </TableCell>

          <!-- Role -->
          <TableCell>
            <span v-if="user.role" class="text-sm">
              {{ user.role.name }}
            </span>
            <span v-else class="text-sm text-muted-foreground italic">
              {{ t('adminUsers.table.noRole') }}
            </span>
          </TableCell>

          <!-- Actions -->
          <TableCell>
            <Button
              variant="outline"
              size="sm"
              @click="props.onViewUser(user.id)"
              class="h-8 px-3"
            >
              <Eye class="h-4 w-4 mr-1" />
              {{ t('adminUsers.table.actions.view') }}
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
