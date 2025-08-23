/**
 * Composable for device management
 * Provides reactive device state and operations
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useEventBus } from '@/composables/useEventBus'
import { DeviceService } from '@/services/deviceService'
import type { Device, DeviceTableItem } from '@/views/devices/types'

export function useDevices() {
  const { t } = useI18n()
  const eventBus = useEventBus()

  // State
  const devices = ref<Device[]>([])
  const isLoading = ref(false)
  const isUpdating = ref(false)
  const isRemoving = ref(false)

  // Computed
  const sortedDevices = computed<DeviceTableItem[]>(() => {
    return devices.value.map(device => {
      const statusBadgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = device.is_active ? 'default' : 'secondary'
      
      return {
        ...device,
        statusBadgeVariant,
        osDisplayName: getOSDisplayName(device.os_type),
        lastActivityDisplay: formatLastActivity(device.last_activity_at || device.last_login_at),
        trustStatusDisplay: device.is_trusted ? t('devices.status.trusted') : t('devices.status.untrusted')
      }
    }).sort((a, b) => {
      // Sort by last activity, then by device name
      const aTime = new Date(a.last_activity_at || a.last_login_at || a.created_at).getTime()
      const bTime = new Date(b.last_activity_at || b.last_login_at || b.created_at).getTime()
      if (aTime !== bTime) {
        return bTime - aTime // Most recent first
      }
      return a.device_name.localeCompare(b.device_name)
    })
  })

  const deviceStats = computed(() => {
    const total = devices.value.length
    const active = devices.value.filter(d => d.is_active).length
    const trusted = devices.value.filter(d => d.is_trusted).length
    const inactive = total - active

    return { total, active, trusted, inactive }
  })

  // Helper functions
  function getOSDisplayName(osType: string | null): string {
    if (!osType) return t('devices.os.unknown')

    const osMap: Record<string, string> = {
      'windows': t('devices.os.windows'),
      'darwin': t('devices.os.macos'),
      'macos': t('devices.os.macos'),
      'linux': t('devices.os.linux')
    }

    return osMap[osType.toLowerCase()] || osType
  }

  function formatLastActivity(timestamp: string | null): string {
    if (!timestamp) return t('devices.time.never')

    const now = new Date()
    const activityTime = new Date(timestamp)
    const diffMs = now.getTime() - activityTime.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffMinutes < 1) return t('devices.time.justNow')
    if (diffMinutes < 60) return t('devices.time.minutesAgo', { minutes: diffMinutes })

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return t('devices.time.hoursAgo', { hours: diffHours })

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return t('devices.time.daysAgo', { days: diffDays })

    const diffWeeks = Math.floor(diffDays / 7)
    if (diffWeeks < 4) return t('devices.time.weeksAgo', { weeks: diffWeeks })

    const diffMonths = Math.floor(diffDays / 30)
    return t('devices.time.monthsAgo', { months: diffMonths })
  }

  // API operations
  async function fetchDevices() {
    try {
      isLoading.value = true
      devices.value = await DeviceService.getAllDevices()
      eventBus.emit('devices-loaded', { devices: devices.value })
    } catch (error) {
      console.error('Failed to fetch devices:', error)
      toast.error(t('devices.errors.loadDevices'), {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    } finally {
      isLoading.value = false
    }
  }

  async function updateDevice(deviceId: string, updates: { device_name?: string }) {
    try {
      isUpdating.value = true
      const updatedDevice = await DeviceService.updateDevice(deviceId, updates)

      // Update local state
      const index = devices.value.findIndex(d => d.id === deviceId)
      if (index !== -1) {
        devices.value[index] = updatedDevice
      }

      // Show success message
      toast.success(t('devices.messages.deviceUpdated'))

      // Emit event for other components
      eventBus.emit('device-updated', { device: updatedDevice })

      return updatedDevice
    } catch (error) {
      console.error('Failed to update device:', error)
      toast.error(t('devices.errors.updateDevice'), {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    } finally {
      isUpdating.value = false
    }
  }

  async function removeDevice(deviceId: string) {
    try {
      isRemoving.value = true
      await DeviceService.removeDevice(deviceId)

      // Remove from local state
      devices.value = devices.value.filter(d => d.id !== deviceId)

      // Show success message
      toast.success(t('devices.messages.deviceRemoved'))

      // Emit event for other components
      eventBus.emit('device-removed', { deviceId })

    } catch (error) {
      console.error('Failed to remove device:', error)
      toast.error(t('devices.errors.removeDevice'), {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    } finally {
      isRemoving.value = false
    }
  }

  return {
    // State
    devices,
    sortedDevices,
    deviceStats,
    isLoading,
    isUpdating,
    isRemoving,

    // Methods
    fetchDevices,
    updateDevice,
    removeDevice,
    getOSDisplayName,
    formatLastActivity
  }
}
