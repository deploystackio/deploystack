/**
 * Composable for device detail management
 * Provides reactive device detail state and operations
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useEventBus } from '@/composables/useEventBus'
import { DeviceService } from '@/services/deviceService'
import type { Device } from '@/views/devices/types'

export function useDeviceDetail() {
  const { t } = useI18n()
  const eventBus = useEventBus()

  // State
  const device = ref<Device | null>(null)
  const isLoading = ref(false)

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

  function formatTimestamp(timestamp: string | null): string {
    if (!timestamp) return t('devices.time.never')
    return new Date(timestamp).toLocaleString()
  }

  // Computed device information
  const deviceInfo = computed(() => {
    if (!device.value) return []
    
    return [
      {
        label: t('devices.detail.fields.deviceId'),
        value: device.value.id,
        icon: 'Monitor'
      },
      {
        label: t('devices.detail.fields.hostname'),
        value: device.value.hostname || t('devices.detail.fields.unknown'),
        icon: 'Globe'
      },
      {
        label: t('devices.detail.fields.operatingSystem'),
        value: `${getOSDisplayName(device.value.os_type)} ${device.value.os_version || ''}`.trim(),
        icon: 'HardDrive'
      },
      {
        label: t('devices.detail.fields.architecture'),
        value: device.value.arch || t('devices.detail.fields.unknown'),
        icon: 'Cpu'
      },
      {
        label: t('devices.detail.fields.nodeVersion'),
        value: device.value.node_version || t('devices.detail.fields.unknown'),
        icon: 'Cpu'
      },
      {
        label: t('devices.detail.fields.hardwareId'),
        value: device.value.hardware_id || t('devices.detail.fields.unknown'),
        icon: 'Monitor'
      },
      {
        label: t('devices.detail.fields.userAgent'),
        value: device.value.user_agent || t('devices.detail.fields.unknown'),
        icon: 'Globe'
      }
    ]
  })

  const deviceTimestamps = computed(() => {
    if (!device.value) return []
    
    return [
      {
        label: t('devices.detail.fields.deviceRegistered'),
        value: device.value.created_at,
        icon: 'Calendar'
      },
      {
        label: t('devices.detail.fields.lastUpdated'),
        value: device.value.updated_at,
        icon: 'Calendar'
      },
      {
        label: t('devices.detail.fields.lastLogin'),
        value: device.value.last_login_at,
        icon: 'Calendar'
      },
      {
        label: t('devices.detail.fields.lastActivity'),
        value: device.value.last_activity_at,
        icon: 'Calendar'
      }
    ]
  })

  // API operations
  async function fetchDevice(deviceId: string) {
    try {
      isLoading.value = true
      device.value = await DeviceService.getDevice(deviceId)
      eventBus.emit('device-loaded', { device: device.value })
    } catch (error) {
      console.error('Failed to fetch device:', error)
      if (error instanceof Error && error.message === 'Device not found') {
        toast.error('Device not found')
      } else {
        toast.error(t('devices.errors.loadDevices'), {
          description: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      throw error
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    device,
    isLoading,
    deviceInfo,
    deviceTimestamps,
    
    // Methods
    fetchDevice,
    getOSDisplayName,
    formatTimestamp
  }
}
