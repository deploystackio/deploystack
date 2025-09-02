<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { Device } from '@/views/devices/types'

interface Props {
  device: Device | null
  open: boolean
  removeDevice: (deviceId: string) => Promise<void>
  isRemoving: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'device-removed', device: Device): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

async function handleConfirmRemove() {
  if (!props.device) return

  try {
    await props.removeDevice(props.device.id)
    emit('device-removed', props.device)
    emit('update:open', false)
  } catch {
    // Error handled in composable with toast
  }
}

function handleCancel() {
  emit('update:open', false)
}
</script>

<template>
  <AlertDialog :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('devices.removeDialog.title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('devices.removeDialog.description', { deviceName: device?.device_name || '' }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div class="text-sm text-muted-foreground">
        {{ t('devices.removeDialog.warning') }}
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel @click="handleCancel" :disabled="props.isRemoving">
          {{ t('devices.removeDialog.buttons.cancel') }}
        </AlertDialogCancel>
        <Button
          @click="handleConfirmRemove"
          :loading="props.isRemoving"
          :loading-text="t('devices.removeDialog.buttons.removing')"
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {{ t('devices.removeDialog.buttons.remove') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
