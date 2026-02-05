<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { MoreVertical } from 'lucide-vue-next'
import { SatelliteService, type Satellite } from '@/services/satelliteService'
import { toast } from 'vue-sonner'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  satellite: Satellite
}

const props = defineProps<Props>()
const emit = defineEmits<{
  satelliteUpdated: [satellite: Satellite]
}>()
const { t } = useI18n()
const router = useRouter()

const showStatusDialog = ref(false)
const selectedStatus = ref<Satellite['status']>('active')
const isUpdating = ref(false)

const showDeleteDialog = ref(false)
const isDeleting = ref(false)

// Check if satellite can be deleted (must be inactive)
const canDelete = computed(() => {
  return props.satellite.status === 'inactive'
})

// Initialize selected status when dialog opens
watch(showStatusDialog, (isOpen) => {
  if (isOpen) {
    selectedStatus.value = props.satellite.status
  }
})

// Handle status change
async function handleStatusChange() {
  try {
    isUpdating.value = true
    const response = await SatelliteService.updateSatelliteStatus(
      props.satellite.id,
      selectedStatus.value
    )

    // Emit updated satellite
    emit('satelliteUpdated', response.data.satellite)

    // Close dialog
    showStatusDialog.value = false

    // Show success toast
    toast.success(t('satellites.manage.statusDialog.successTitle'), {
      description: t('satellites.manage.statusDialog.successDescription')
    })
  } catch (error) {
    toast.error(t('satellites.manage.statusDialog.errorTitle'), {
      description: error instanceof Error ? error.message : t('satellites.manage.statusDialog.errorDescription')
    })
  } finally {
    isUpdating.value = false
  }
}

// Handle delete click
function handleDeleteClick() {
  if (!canDelete.value) {
    toast.error(t('satellites.manage.deleteDialog.notInactiveTitle'), {
      description: t('satellites.manage.deleteDialog.notInactiveDescription', {
        status: props.satellite.status
      })
    })
    return
  }

  showDeleteDialog.value = true
}

// Handle delete confirmation
async function handleDeleteConfirm() {
  try {
    isDeleting.value = true
    const response = await SatelliteService.deleteSatellite(props.satellite.id)

    // Show success toast
    toast.success(t('satellites.manage.deleteDialog.successTitle'), {
      description: response.message
    })

    // Close dialog
    showDeleteDialog.value = false

    // Navigate back to satellites list
    router.push('/admin/satellites')
  } catch (error) {
    toast.error(t('satellites.manage.deleteDialog.errorTitle'), {
      description: error instanceof Error ? error.message : t('satellites.manage.deleteDialog.errorDescription')
    })
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="icon">
        <MoreVertical class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem @click="showStatusDialog = true">
        {{ t('satellites.manage.actions.changeStatus') }}
      </DropdownMenuItem>
      <DropdownMenuItem @click="handleDeleteClick" class="text-red-600 focus:text-red-600">
        {{ t('satellites.manage.actions.deleteSatellite') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <!-- Status Change Dialog -->
  <Dialog v-model:open="showStatusDialog">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{{ t('satellites.manage.statusDialog.title') }}</DialogTitle>
        <DialogDescription>
          {{ t('satellites.manage.statusDialog.description') }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-4">
        <div class="grid gap-3">
          <Label for="status">{{ t('satellites.manage.statusDialog.statusLabel') }}</Label>
          <Select v-model="selectedStatus">
            <SelectTrigger id="status" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{{ t('satellites.status.active') }}</SelectItem>
              <SelectItem value="inactive">{{ t('satellites.status.inactive') }}</SelectItem>
              <SelectItem value="maintenance">{{ t('satellites.status.maintenance') }}</SelectItem>
              <SelectItem value="error">{{ t('satellites.status.error') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline">{{ t('satellites.manage.statusDialog.cancel') }}</Button>
        </DialogClose>
        <Button @click="handleStatusChange" :disabled="isUpdating">
          <Spinner v-if="isUpdating" class="mr-2 h-4 w-4" />
          {{ isUpdating ? t('satellites.manage.statusDialog.saving') : t('satellites.manage.statusDialog.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Delete Confirmation Dialog -->
  <AlertDialog v-model:open="showDeleteDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('satellites.manage.deleteDialog.title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('satellites.manage.deleteDialog.description', { name: satellite.name }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="isDeleting">
          {{ t('satellites.manage.deleteDialog.cancel') }}
        </AlertDialogCancel>
        <AlertDialogAction @click="handleDeleteConfirm" :disabled="isDeleting" class="bg-red-600 hover:bg-red-700">
          <Spinner v-if="isDeleting" class="mr-2 h-4 w-4" />
          {{ isDeleting ? t('satellites.manage.deleteDialog.deleting') : t('satellites.manage.deleteDialog.delete') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
