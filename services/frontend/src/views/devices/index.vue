<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DashboardLayout from '@/components/DashboardLayout.vue'
import ContentWrapper from '@/components/ContentWrapper.vue'
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Monitor,
  Laptop
} from 'lucide-vue-next'
import { useDevices } from '@/composables/useDevices'
import type { Device } from './types'

const { t } = useI18n()

// Use devices composable
const {
  sortedDevices,
  deviceStats,
  isLoading,
  isUpdating,
  isRemoving,
  fetchDevices,
  updateDevice,
  removeDevice
} = useDevices()

// Edit dialog state
const editDialogOpen = ref(false)
const editingDevice = ref<Device | null>(null)
const editDeviceName = ref('')

// Remove dialog state
const removeDialogOpen = ref(false)
const removingDevice = ref<Device | null>(null)

// Event handlers
function handleEdit(device: Device) {
  editingDevice.value = device
  editDeviceName.value = device.device_name
  editDialogOpen.value = true
}

function handleRemove(device: Device) {
  removingDevice.value = device
  removeDialogOpen.value = true
}

async function handleSaveEdit() {
  if (!editingDevice.value || !editDeviceName.value.trim()) return

  try {
    await updateDevice(editingDevice.value.id, {
      device_name: editDeviceName.value.trim()
    })

    editDialogOpen.value = false
    editingDevice.value = null
    editDeviceName.value = ''
  } catch {
    // Error handled in composable
  }
}

async function handleConfirmRemove() {
  if (!removingDevice.value) return

  try {
    await removeDevice(removingDevice.value.id)

    removeDialogOpen.value = false
    removingDevice.value = null
  } catch {
    // Error handled in composable
  }
}

function handleCancelEdit() {
  editDialogOpen.value = false
  editingDevice.value = null
  editDeviceName.value = ''
}

function handleCancelRemove() {
  removeDialogOpen.value = false
  removingDevice.value = null
}

// Lifecycle
onMounted(() => {
  fetchDevices()
})
</script>

<template>
  <DashboardLayout :title="t('devices.pageTitle')">
    <ContentWrapper>
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-muted-foreground">{{ t('devices.pageDescription') }}</p>
          </div>
          <div class="flex items-center gap-4">
            <!-- Device Stats -->
            <div class="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
              <div class="flex items-center gap-1">
                <Monitor class="h-4 w-4" />
                <span>{{ deviceStats.total }} {{ t('devices.stats.total') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Devices Table -->
        <div class="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('devices.table.columns.deviceName') }}</TableHead>
                <TableHead>{{ t('devices.table.columns.operatingSystem') }}</TableHead>
                <TableHead>{{ t('devices.table.columns.lastActivity') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('devices.table.columns.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <!-- Loading state -->
              <TableRow v-if="isLoading">
                <TableCell :colspan="4" class="h-24 text-center">
                  <div class="flex items-center justify-center">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span class="ml-2">Loading devices...</span>
                  </div>
                </TableCell>
              </TableRow>

              <!-- Empty State -->
              <TableRow v-else-if="sortedDevices.length === 0">
                <TableCell :colspan="4" class="h-32 text-center">
                  <div class="flex flex-col items-center justify-center space-y-2">
                    <Laptop class="h-12 w-12 text-muted-foreground" />
                    <div class="text-lg font-medium">{{ t('devices.emptyState.title') }}</div>
                    <div class="text-sm text-muted-foreground max-w-md">
                      {{ t('devices.emptyState.description') }}
                    </div>
                  </div>
                </TableCell>
              </TableRow>

              <!-- Device Rows -->
              <TableRow v-for="device in sortedDevices" :key="device.id">
                <TableCell class="font-medium">
                  <div class="flex items-center gap-2">
                    <Monitor class="h-4 w-4 text-muted-foreground" />
                    <router-link
                      :to="`/devices/view/${device.id}`"
                      class="hover:underline hover:text-primary cursor-pointer"
                    >
                      {{ device.device_name }}
                    </router-link>
                  </div>
                </TableCell>
                <TableCell>
                  <span class="text-sm">{{ device.osDisplayName }}</span>
                  <span v-if="device.arch" class="text-xs text-muted-foreground ml-1">
                    ({{ device.arch }})
                  </span>
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ device.lastActivityDisplay }}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" class="h-8 w-8 p-0">
                        <span class="sr-only">{{ t('devices.table.openMenu') }}</span>
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="$router.push(`/devices/view/${device.id}`)">
                        <Monitor class="mr-2 h-4 w-4" />
                        {{ t('devices.actions.viewDetails') }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="handleEdit(device)">
                        <Edit class="mr-2 h-4 w-4" />
                        {{ t('devices.actions.editDevice') }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="handleRemove(device)" class="text-destructive focus:text-destructive">
                        <Trash2 class="mr-2 h-4 w-4" />
                        {{ t('devices.actions.removeDevice') }}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <!-- Edit Device Dialog -->
      <AlertDialog :open="editDialogOpen" @update:open="editDialogOpen = $event">
        <AlertDialogContent class="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{{ t('devices.editDialog.title') }}</AlertDialogTitle>
            <AlertDialogDescription>
              {{ t('devices.editDialog.description') }}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div class="space-y-4">
            <div class="space-y-2">
              <Label for="device-name">{{ t('devices.editDialog.fields.deviceName.label') }}</Label>
              <Input
                id="device-name"
                v-model="editDeviceName"
                :placeholder="t('devices.editDialog.fields.deviceName.placeholder')"
                @keydown.enter="handleSaveEdit"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              @click="handleCancelEdit"
              :disabled="isUpdating"
            >
              {{ t('devices.editDialog.buttons.cancel') }}
            </Button>
            <Button
              @click="handleSaveEdit"
              :loading="isUpdating"
              :loading-text="t('devices.editDialog.buttons.saving')"
              :disabled="!editDeviceName.trim()"
            >
              {{ t('devices.editDialog.buttons.save') }}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <!-- Remove Device Dialog -->
      <AlertDialog :open="removeDialogOpen" @update:open="removeDialogOpen = $event">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ t('devices.removeDialog.title') }}</AlertDialogTitle>
            <AlertDialogDescription>
              {{ t('devices.removeDialog.description', { deviceName: removingDevice?.device_name || '' }) }}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div class="text-sm text-muted-foreground">
            {{ t('devices.removeDialog.warning') }}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel @click="handleCancelRemove" :disabled="isRemoving">
              {{ t('devices.removeDialog.buttons.cancel') }}
            </AlertDialogCancel>
            <Button
              @click="handleConfirmRemove"
              :loading="isRemoving"
              :loading-text="t('devices.removeDialog.buttons.removing')"
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {{ t('devices.removeDialog.buttons.remove') }}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContentWrapper>
  </DashboardLayout>
</template>
