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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings, Key } from 'lucide-vue-next'
import type { CloudCredential, CloudCredentialBasic } from './types'

interface Props {
  credentials: (CloudCredential | CloudCredentialBasic)[]
  onManage: (credentialId: string) => void
}

const props = defineProps<Props>()
const { t } = useI18n()

// Sort credentials by name for consistency
const sortedCredentials = computed(() => {
  return [...props.credentials].sort((a, b) => a.name.localeCompare(b.name))
})

// Format date for display
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Get created by display info
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const getCreatedByDisplay = (createdBy: any) => {
  if (typeof createdBy === 'object' && createdBy?.username) {
    return {
      username: createdBy.username,
      email: createdBy.email
    }
  }
  return {
    username: typeof createdBy === 'string' ? createdBy : t('credentials.table.values.unknown'),
    email: null
  }
}

// Get provider badge variant
const getProviderVariant = (providerId: string) => {
  // You can customize this based on provider types
  switch (providerId) {
    case 'aws':
      return 'default'
    case 'gcp':
      return 'secondary'
    case 'azure':
      return 'outline'
    default:
      return 'secondary'
  }
}
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-[200px]">{{ t('credentials.table.columns.name') }}</TableHead>
          <TableHead class="w-[150px]">{{ t('credentials.table.columns.provider') }}</TableHead>
          <TableHead>{{ t('credentials.table.columns.comment') }}</TableHead>
          <TableHead class="w-[150px]">{{ t('credentials.table.columns.createdBy') }}</TableHead>
          <TableHead class="w-[120px]">{{ t('credentials.table.columns.createdAt') }}</TableHead>
          <TableHead class="w-[100px] text-right">{{ t('credentials.table.columns.actions') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <!-- Empty State -->
        <TableRow v-if="sortedCredentials.length === 0">
          <TableCell :colspan="6" class="h-24 text-center text-muted-foreground">
            {{ t('credentials.table.noData') }}
          </TableCell>
        </TableRow>

        <!-- Data Rows -->
        <TableRow 
          v-for="credential in sortedCredentials" 
          :key="credential.id"
          class="hover:bg-muted/50"
        >
          <!-- Name -->
          <TableCell>
            <div class="flex items-center gap-2">
              <Key class="h-4 w-4 text-muted-foreground" />
              <div>
                <div class="font-medium">{{ credential.name }}</div>
                <div class="text-xs text-muted-foreground font-mono">{{ credential.id.slice(0, 8) }}...</div>
              </div>
            </div>
          </TableCell>

          <!-- Provider -->
          <TableCell>
            <div class="flex items-center gap-2">
              <img
                :src="`/images/provider/${credential.provider.id}.svg`"
                :alt="credential.provider.name"
                class="w-5 h-5"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              />
              <Badge :variant="getProviderVariant(credential.provider.id)">
                {{ credential.provider.name }}
              </Badge>
            </div>
          </TableCell>

          <!-- Comment -->
          <TableCell>
            <span v-if="credential.comment" class="text-sm">
              {{ credential.comment }}
            </span>
            <span v-else class="text-sm text-muted-foreground italic">
              {{ t('credentials.detail.values.noComment') }}
            </span>
          </TableCell>

          <!-- Created By -->
          <TableCell>
            <div class="text-sm">
              <div class="font-medium">{{ getCreatedByDisplay(credential.createdBy).username }}</div>
              <div
                v-if="getCreatedByDisplay(credential.createdBy).email"
                class="text-xs text-muted-foreground"
              >
                {{ getCreatedByDisplay(credential.createdBy).email }}
              </div>
            </div>
          </TableCell>

          <!-- Created At -->
          <TableCell class="text-sm text-muted-foreground">
            {{ formatDate(credential.createdAt) }}
          </TableCell>

          <!-- Actions -->
          <TableCell class="text-right">
            <Button
              variant="outline"
              size="sm"
              @click="props.onManage(credential.id)"
              class="h-8"
            >
              <Settings class="h-4 w-4 mr-2" />
              {{ t('credentials.actions.view') }}
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
