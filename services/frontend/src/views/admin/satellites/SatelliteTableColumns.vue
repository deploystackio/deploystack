<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown } from 'lucide-vue-next'
import type { Satellite } from '@/services/satelliteService'
import { SatelliteService } from '@/services/satelliteService'
import { SatelliteStatusBadge } from '@/components/admin/satellites'

const { t } = useI18n()
const router = useRouter()

interface Props {
  satellites: Satellite[]
  onStatusUpdate: (satelliteId: string, newStatus: Satellite['status']) => void
  canManageSatellites: boolean
  isLoading?: boolean
}

const props = defineProps<Props>()

// State for status update dialog
const statusUpdateDialogOpen = ref(false)
const satelliteToUpdate = ref<Satellite | null>(null)
const newStatus = ref<Satellite['status']>('active')

// Handle status update confirmation
const handleStatusUpdateClick = (satellite: Satellite, status: Satellite['status']) => {
  satelliteToUpdate.value = satellite
  newStatus.value = status
  statusUpdateDialogOpen.value = true
}

const handleStatusUpdateConfirm = () => {
  if (satelliteToUpdate.value) {
    props.onStatusUpdate(satelliteToUpdate.value.id, newStatus.value)
    statusUpdateDialogOpen.value = false
    satelliteToUpdate.value = null
  }
}

const handleStatusUpdateCancel = () => {
  statusUpdateDialogOpen.value = false
  satelliteToUpdate.value = null
}

// Sort satellites by name
const sortedSatellites = computed(() => {
  return [...props.satellites].sort((a, b) => a.name.localeCompare(b.name))
})

// Get status options for dropdown
const getStatusOptions = (currentStatus: Satellite['status']): Satellite['status'][] => {
  const allStatuses: Satellite['status'][] = ['active', 'inactive', 'maintenance', 'error']
  return allStatuses.filter(status => status !== currentStatus)
}

// Get status display text
const getStatusText = (status: Satellite['status']): string => {
  switch (status) {
    case 'active':
      return t('satellites.status.active')
    case 'inactive':
      return t('satellites.status.inactive')
    case 'maintenance':
      return t('satellites.status.maintenance')
    case 'error':
      return t('satellites.status.error')
    default:
      return status
  }
}

// Get type display text
const getTypeText = (type: Satellite['satellite_type']): string => {
  switch (type) {
    case 'global':
      return t('satellites.type.global')
    case 'team':
      return t('satellites.type.team')
    default:
      return type
  }
}

// Navigate to satellite detail page
const navigateToSatellite = (satelliteId: string) => {
  router.push(`/admin/satellites/${satelliteId}/general`)
}
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{{ t('satellites.table.columns.name') }}</TableHead>
          <TableHead>{{ t('satellites.table.columns.type') }}</TableHead>
          <TableHead>{{ t('satellites.table.columns.status') }}</TableHead>
          <TableHead>{{ t('satellites.table.columns.lastHeartbeat') }}</TableHead>
          <TableHead>{{ t('satellites.table.columns.capabilities') }}</TableHead>
          <TableHead class="w-[120px]">{{ t('satellites.table.columns.actions') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-if="isLoading">
          <TableRow v-for="i in 5" :key="`skeleton-${i}`">
            <TableCell><Skeleton class="h-4 w-32" /></TableCell>
            <TableCell><Skeleton class="h-5 w-16" /></TableCell>
            <TableCell><Skeleton class="h-5 w-20" /></TableCell>
            <TableCell><Skeleton class="h-4 w-24" /></TableCell>
            <TableCell><Skeleton class="h-5 w-28" /></TableCell>
            <TableCell><Skeleton class="h-8 w-[100px]" /></TableCell>
          </TableRow>
        </template>

        <template v-else>
          <TableRow v-if="sortedSatellites.length === 0">
            <TableCell :colspan="6" class="h-24 text-center">
              {{ t('satellites.table.noData') }}
            </TableCell>
          </TableRow>
          <TableRow
            v-for="satellite in sortedSatellites"
            :key="satellite.id"
            class="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
            @click="navigateToSatellite(satellite.id)"
          >
          <TableCell class="font-medium">
            {{ satellite.name }}
          </TableCell>
          <TableCell>
            <Badge :variant="SatelliteService.getTypeVariant(satellite.satellite_type)">
              {{ getTypeText(satellite.satellite_type) }}
            </Badge>
          </TableCell>
          <TableCell>
            <SatelliteStatusBadge :status="satellite.status" />
          </TableCell>
          <TableCell class="text-sm text-muted-foreground">
            {{ SatelliteService.formatLastHeartbeat(satellite.last_heartbeat) }}
          </TableCell>
          <TableCell>
            <div class="flex flex-wrap gap-1">
              <Badge
                v-for="capability in satellite.capabilities"
                :key="capability"
                variant="secondary"
                class="text-xs"
              >
                {{ capability }}
              </Badge>
            </div>
          </TableCell>
          <TableCell @click.stop>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="!canManageSatellites"
                  class="flex items-center gap-1"
                >
                  {{ t('satellites.table.actions.updateStatus') }}
                  <ChevronDown class="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  v-for="status in getStatusOptions(satellite.status)"
                  :key="status"
                  @click="handleStatusUpdateClick(satellite, status)"
                >
                  <Badge
                    :variant="SatelliteService.getStatusVariant(status)"
                    class="mr-2 text-xs"
                  >
                    {{ getStatusText(status) }}
                  </Badge>
                  {{ t('satellites.actions.setStatus', { status: getStatusText(status) }) }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
        </template>
      </TableBody>
    </Table>
  </div>

  <!-- Status Update Confirmation Dialog -->
  <AlertDialog :open="statusUpdateDialogOpen" @update:open="statusUpdateDialogOpen = $event">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('satellites.statusUpdateDialog.title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('satellites.statusUpdateDialog.description', {
            satelliteName: satelliteToUpdate?.name || '',
            currentStatus: satelliteToUpdate ? getStatusText(satelliteToUpdate.status) : '',
            newStatus: getStatusText(newStatus)
          }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="handleStatusUpdateCancel">
          {{ t('satellites.statusUpdateDialog.cancel') }}
        </AlertDialogCancel>
        <AlertDialogAction @click="handleStatusUpdateConfirm">
          {{ t('satellites.statusUpdateDialog.confirm') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
