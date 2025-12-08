<script setup lang="ts">
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
import { AlertTriangle, Trash2 } from 'lucide-vue-next'

interface Props {
  open: boolean
  serverName: string
  isDeleting?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isDeleting: false
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': []
}>()

const { t } = useI18n()

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('update:open', false)
}
</script>

<template>
  <AlertDialog :open="props.open" @update:open="emit('update:open', $event)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="flex items-center gap-2 text-red-600">
          <AlertTriangle class="h-5 w-5" />
          {{ t('mcpCatalog.edit.deleteDialog.title') }}
        </AlertDialogTitle>
        <AlertDialogDescription class="space-y-2">
          <p>{{ t('mcpCatalog.edit.deleteDialog.warning') }}</p>
          <p class="font-medium">{{ t('mcpCatalog.edit.deleteDialog.serverName') }}: "{{ props.serverName }}"</p>
          <div class="bg-red-50 p-3 rounded-md">
            <p class="text-sm text-red-800">{{ t('mcpCatalog.edit.deleteDialog.consequences') }}</p>
            <ul class="text-xs text-red-700 mt-2 space-y-1">
              <li>{{ t('mcpCatalog.edit.deleteDialog.consequencesList.server') }}</li>
              <li>{{ t('mcpCatalog.edit.deleteDialog.consequencesList.configurations') }}</li>
              <li>{{ t('mcpCatalog.edit.deleteDialog.consequencesList.history') }}</li>
            </ul>
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="handleCancel" :disabled="props.isDeleting">
          {{ t('mcpCatalog.edit.deleteDialog.cancel') }}
        </AlertDialogCancel>
        <AlertDialogAction
          @click="handleConfirm"
          :disabled="props.isDeleting"
          class="bg-red-600 hover:bg-red-700 flex items-center gap-2"
        >
          <Trash2 class="h-4 w-4" />
          {{ props.isDeleting ? t('mcpCatalog.edit.deleteDialog.deleting') : t('mcpCatalog.edit.deleteDialog.confirm') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
