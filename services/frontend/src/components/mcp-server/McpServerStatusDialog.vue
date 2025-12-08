<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
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

interface McpServerBasic {
  id: string
  name: string
  status: string
}

interface Props {
  open: boolean
  server: McpServerBasic | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': [serverId: string, newStatus: 'active' | 'disabled']
}>()

const { t } = useI18n()

const isDisabling = computed(() => props.server?.status !== 'disabled')

const dialogTitle = computed(() => {
  return isDisabling.value
    ? t('mcpCatalog.statusDialog.disableTitle')
    : t('mcpCatalog.statusDialog.enableTitle')
})

const dialogDescription = computed(() => {
  return isDisabling.value
    ? t('mcpCatalog.statusDialog.disableDescription', { serverName: props.server?.name || '' })
    : t('mcpCatalog.statusDialog.enableDescription', { serverName: props.server?.name || '' })
})

const confirmButtonText = computed(() => {
  return isDisabling.value
    ? t('mcpCatalog.statusDialog.confirmDisable')
    : t('mcpCatalog.statusDialog.confirmEnable')
})

const handleConfirm = () => {
  if (props.server) {
    const newStatus = isDisabling.value ? 'disabled' : 'active'
    emit('confirm', props.server.id, newStatus)
    emit('update:open', false)
  }
}

const handleCancel = () => {
  emit('update:open', false)
}
</script>

<template>
  <AlertDialog :open="props.open" @update:open="emit('update:open', $event)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ dialogTitle }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ dialogDescription }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="handleCancel">
          {{ t('mcpCatalog.statusDialog.cancel') }}
        </AlertDialogCancel>
        <AlertDialogAction @click="handleConfirm">
          {{ confirmButtonText }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
