<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-vue-next'
import type { CloudCredential, CloudCredentialBasic } from '@/types/credentials'

interface Props {
  credentials: (CloudCredential | CloudCredentialBasic)[]
  onManage: (credentialId: string) => void
}

const props = defineProps<Props>()

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
    username: typeof createdBy === 'string' ? createdBy : 'Unknown',
    email: null
  }
}
</script>

<template>
  <div class="rounded-md border">
    <table class="w-full">
      <thead>
        <tr class="border-b">
          <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
            Name
          </th>
          <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
            Provider
          </th>
          <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
            Comment
          </th>
          <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
            Created By
          </th>
          <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
            Created
          </th>
          <th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
            Manage
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="credential in credentials"
          :key="credential.id"
          class="border-b transition-colors hover:bg-muted/50"
        >
          <!-- Name -->
          <td class="p-4 align-middle">
            <div class="font-medium">{{ credential.name }}</div>
          </td>

          <!-- Provider -->
          <td class="p-4 align-middle">
            <div class="flex items-center gap-2">
              <img
                :src="`/images/provider/${credential.provider.id}.svg`"
                :alt="credential.provider.name"
                class="w-5 h-5"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              />
              <Badge variant="secondary">{{ credential.provider.name }}</Badge>
            </div>
          </td>

          <!-- Comment -->
          <td class="p-4 align-middle">
            <div
              :class="credential.comment ? 'text-sm' : 'text-sm text-muted-foreground italic'"
            >
              {{ credential.comment || 'No comment' }}
            </div>
          </td>

          <!-- Created By -->
          <td class="p-4 align-middle">
            <div class="text-sm">
              <div class="font-medium">{{ getCreatedByDisplay(credential.createdBy).username }}</div>
              <div
                v-if="getCreatedByDisplay(credential.createdBy).email"
                class="text-xs text-muted-foreground"
              >
                {{ getCreatedByDisplay(credential.createdBy).email }}
              </div>
            </div>
          </td>

          <!-- Created -->
          <td class="p-4 align-middle">
            <div class="text-sm text-muted-foreground">
              {{ formatDate(credential.createdAt) }}
            </div>
          </td>

          <!-- Manage -->
          <td class="p-4 align-middle">
            <div class="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                class="h-8 px-3"
                @click="props.onManage(credential.id)"
              >
                <Settings class="h-4 w-4 mr-1" />
                Manage
              </Button>
            </div>
          </td>
        </tr>

        <!-- Empty state -->
        <tr v-if="credentials.length === 0">
          <td colspan="6" class="h-24 text-center">
            No credentials found
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
