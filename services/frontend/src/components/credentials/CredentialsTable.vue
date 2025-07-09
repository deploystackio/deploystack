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
import { Settings } from 'lucide-vue-next'
import type { CloudCredential, CloudCredentialBasic } from '@/types/credentials'

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

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

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
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{{ t('credentials.table.columns.name') }}</TableHead>
          <TableHead>{{ t('credentials.table.columns.provider') }}</TableHead>
          <TableHead>{{ t('credentials.table.columns.comment') }}</TableHead>
          <TableHead>{{ t('credentials.table.columns.createdBy') }}</TableHead>
          <TableHead>{{ t('credentials.table.columns.createdAt') }}</TableHead>
          <TableHead class="w-[100px]">{{ t('credentials.table.columns.actions') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <!-- Empty State -->
        <TableRow v-if="sortedCredentials.length === 0">
          <TableCell :colspan="6" class="h-24 text-center">
            {{ t('credentials.table.noData') }}
          </TableCell>
        </TableRow>

        <!-- Data Rows -->
        <TableRow v-for="credential in sortedCredentials" :key="credential.id">
          <!-- Name -->
          <TableCell class="font-medium">
            {{ credential.name }}
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
              <Badge variant="secondary">{{ credential.provider.name }}</Badge>
            </div>
          </TableCell>

          <!-- Comment -->
          <TableCell>
            <span v-if="credential.comment" class="text-sm text-muted-foreground">
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

          <!-- Created -->
          <TableCell class="text-sm text-muted-foreground">
            {{ formatDate(credential.createdAt) }}
          </TableCell>

          <!-- Actions -->
          <TableCell>
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
