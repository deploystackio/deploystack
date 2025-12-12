<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2, Clock, Globe, Users, Shield, CircleCheck, CircleX, CircleMinus } from 'lucide-vue-next'
import type { RegistrationToken } from '@/services/satelliteTokenService'

interface Props {
  tokens: RegistrationToken[]
}

interface Emits {
  (e: 'token-revoked', tokenId: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()
const router = useRouter()

// Format token status
const getTokenStatus = (token: RegistrationToken) => {
  if (token.used) {
    return {
      label: t('satellites.status.used'),
      variant: 'secondary' as const,
      icon: Shield
    }
  }

  const isExpired = new Date() > new Date(token.expires_at)
  if (isExpired) {
    return {
      label: t('satellites.status.expired'),
      variant: 'destructive' as const,
      icon: Clock
    }
  }

  return {
    label: t('satellites.status.active'),
    variant: 'default' as const,
    icon: Clock
  }
}

// Format token type
const getTokenType = (token: RegistrationToken) => {
  if (token.token_type === 'global') {
    return {
      label: t('satellites.type.global'),
      variant: 'default' as const,
      icon: Globe
    }
  } else {
    return {
      label: t('satellites.type.team'),
      variant: 'outline' as const,
      icon: Users
    }
  }
}

// Format time remaining
const formatTimeRemaining = (expiresAt: string) => {
  const expires = new Date(expiresAt)
  const now = new Date()

  if (now > expires) {
    return t('satellites.pairing.tokenTable.timeRemaining.expired')
  }

  const diff = expires.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return t('satellites.pairing.tokenTable.timeRemaining.inDaysHours', { days, hours: hours % 24 })
  } else if (hours > 0) {
    return t('satellites.pairing.tokenTable.timeRemaining.inHoursMinutes', { hours, minutes })
  } else {
    return t('satellites.pairing.tokenTable.timeRemaining.inMinutes', { minutes })
  }
}

// Format creation date
const formatCreatedDate = (createdAt: string) => {
  const created = new Date(createdAt)
  const now = new Date()
  const diff = now.getTime() - created.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return t('satellites.pairing.tokenTable.timeAgo.days', { count: days })
  } else if (hours > 0) {
    return t('satellites.pairing.tokenTable.timeAgo.hours', { count: hours })
  } else {
    const minutes = Math.floor(diff / (1000 * 60))
    return t('satellites.pairing.tokenTable.timeAgo.minutes', { count: minutes })
  }
}

// Check if token can be revoked
const canRevokeToken = (token: RegistrationToken) => {
  return !token.used && new Date(token.expires_at) > new Date()
}

// Handle token revocation
const handleRevokeToken = (tokenId: string) => {
  emit('token-revoked', tokenId)
}

// Navigate to user page
const goToUser = (userId: string) => {
  router.push(`/admin/users/${userId}`)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Empty State -->
    <div v-if="tokens.length === 0" class="text-center py-12">
      <Shield class="mx-auto h-12 w-12 text-muted-foreground/50" />
      <h3 class="mt-4 text-lg font-semibold">{{ t('satellites.pairing.emptyState.title') }}</h3>
      <p class="mt-2 text-sm text-muted-foreground">
        {{ t('satellites.pairing.emptyState.description') }}
      </p>
    </div>

    <!-- Tokens Table -->
    <div v-else class="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('satellites.pairing.tokenTable.columns.status') }}</TableHead>
            <TableHead>{{ t('satellites.pairing.tokenTable.columns.type') }}</TableHead>
            <TableHead>{{ t('satellites.pairing.tokenTable.columns.scope') }}</TableHead>
            <TableHead>{{ t('satellites.pairing.tokenTable.columns.createdBy') }}</TableHead>
            <TableHead>{{ t('satellites.pairing.tokenTable.columns.created') }}</TableHead>
            <TableHead>{{ t('satellites.pairing.tokenTable.columns.expires') }}</TableHead>
            <TableHead class="w-[80px]">{{ t('satellites.table.columns.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="token in tokens"
            :key="token.id"
            class="hover:bg-muted/50"
          >
            <!-- Status -->
            <TableCell>
              <div class="inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-xs font-medium text-muted-foreground gap-1">
                <CircleCheck
                  v-if="!token.used && new Date() <= new Date(token.expires_at)"
                  class="size-3 fill-green-500 text-green-500 dark:fill-green-400 dark:text-green-400"
                />
                <CircleX
                  v-else-if="new Date() > new Date(token.expires_at)"
                  class="size-3 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400"
                />
                <CircleMinus
                  v-else
                  class="size-3 text-muted-foreground"
                />
                <span>{{ getTokenStatus(token).label }}</span>
              </div>
            </TableCell>

            <!-- Type -->
            <TableCell>
              <Badge
                :variant="getTokenType(token).variant"
                class="flex items-center gap-1"
              >
                <component :is="getTokenType(token).icon" class="h-3 w-3" />
                {{ getTokenType(token).label }}
              </Badge>
            </TableCell>

            <!-- Scope -->
            <TableCell>
              <div class="flex items-center gap-2">
                <component
                  :is="token.token_type === 'global' ? Globe : Users"
                  class="h-4 w-4 text-muted-foreground"
                />
                <span class="text-sm">
                  {{ token.token_type === 'global' ? t('satellites.pairing.tokenTable.scopes.allTeams') : (token.team_slug || t('satellites.pairing.tokenTable.scopes.team')) }}
                </span>
              </div>
            </TableCell>

            <!-- Created By -->
            <TableCell>
              <a
                class="link text-sm"
                :href="`/admin/users/${token.created_by}`"
                @click.prevent="goToUser(token.created_by)"
              >
                {{ token.creator_name || token.created_by }}
              </a>
            </TableCell>

            <!-- Created -->
            <TableCell>
              <span class="text-sm text-muted-foreground">
                {{ formatCreatedDate(token.created_at) }}
              </span>
            </TableCell>

            <!-- Expires -->
            <TableCell>
              <div class="flex items-center gap-1">
                <Clock class="h-3 w-3 text-muted-foreground" />
                <span class="text-sm" :class="{
                  'text-red-500': getTokenStatus(token).label === 'Expired',
                  'text-muted-foreground': getTokenStatus(token).label !== 'Expired'
                }">
                  {{ formatTimeRemaining(token.expires_at) }}
                </span>
              </div>
            </TableCell>

            <!-- Actions -->
            <TableCell>
              <AlertDialog v-if="canRevokeToken(token)">
                <AlertDialogTrigger as-child>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 class="h-4 w-4" />
                    <span class="sr-only">Revoke token</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{{ t('satellites.pairing.revokeToken.title') }}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {{ t('satellites.pairing.revokeToken.description') }}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{{ t('satellites.pairing.revokeToken.buttons.cancel') }}</AlertDialogCancel>
                    <AlertDialogAction
                      @click="handleRevokeToken(token.id)"
                      class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {{ t('satellites.pairing.revokeToken.buttons.revoke') }}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <!-- Disabled action for used/expired tokens -->
              <Button
                v-else
                variant="ghost"
                size="sm"
                disabled
                class="h-8 w-8 p-0"
              >
                <Trash2 class="h-4 w-4" />
                <span class="sr-only">Cannot revoke token</span>
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
