<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import DashboardLayout from '@/components/DashboardLayout.vue'
import ContentWrapper from '@/components/ContentWrapper.vue'
import { 
  ArrowLeft, 
  Monitor, 
  Shield, 
  ShieldOff,
  Calendar,
  Globe,
  Cpu,
  HardDrive,
  AlertCircle,
  Edit,
  Trash2
} from 'lucide-vue-next'
import { useDeviceDetail } from '@/composables/useDeviceDetail'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

// Use device detail composable
const {
  device,
  isLoading,
  deviceInfo,
  deviceTimestamps,
  fetchDevice,
  getOSDisplayName,
  formatTimestamp
} = useDeviceDetail()

// Computed
const deviceId = computed(() => route.params.id as string)





// State for error handling (composable throws, we catch here)
const error = ref<string | null>(null)

// Event handlers
function handleBack() {
  router.push('/devices')
}

// Lifecycle
onMounted(async () => {
  try {
    await fetchDevice(deviceId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load device'
  }
})
</script>

<template>
  <DashboardLayout :title="device?.device_name || 'Device Details'">
    <ContentWrapper>
      <div class="space-y-6">
      <!-- Back Navigation -->
      <div class="flex items-center gap-4">
        <Button variant="ghost" @click="handleBack" class="flex items-center gap-2">
          <ArrowLeft class="h-4 w-4" />
          Back to Devices
        </Button>
      </div>

      <!-- Error State -->
      <Alert v-if="error" class="border-destructive">
        <AlertCircle class="h-4 w-4" />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center h-32">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span class="ml-3">Loading device details...</span>
      </div>

      <!-- Device Details -->
      <div v-else-if="device" class="space-y-6">
        <!-- Device Header -->
        <div class="flex items-start justify-between">
          <div class="space-y-1">
            <div class="flex items-center gap-3">
              <Monitor class="h-6 w-6 text-muted-foreground" />
              <h1 class="text-2xl font-bold">{{ device.device_name }}</h1>
            </div>
            <p class="text-muted-foreground">
              {{ getOSDisplayName(device.os_type) }}
              <span v-if="device.arch"> • {{ device.arch }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Badge :variant="device.is_active ? 'default' : 'secondary'">
              {{ device.is_active ? t('devices.status.active') : t('devices.status.inactive') }}
            </Badge>
            <div class="flex items-center gap-1">
              <Shield v-if="device.is_trusted" class="h-4 w-4 text-green-600" />
              <ShieldOff v-else class="h-4 w-4 text-yellow-600" />
              <Badge variant="outline">
                {{ device.is_trusted ? t('devices.status.trusted') : t('devices.status.untrusted') }}
              </Badge>
            </div>
          </div>
        </div>

        <!-- Device Information Cards -->
        <div class="grid gap-6 md:grid-cols-2">
          <!-- System Information -->
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <Monitor class="h-5 w-5" />
                System Information
              </CardTitle>
              <CardDescription>
                Hardware and system details for this device
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div v-for="info in deviceInfo" :key="info.label" class="flex items-start gap-3">
                <Monitor v-if="info.icon === 'Monitor'" class="h-4 w-4 text-muted-foreground mt-0.5" />
                <Globe v-else-if="info.icon === 'Globe'" class="h-4 w-4 text-muted-foreground mt-0.5" />
                <HardDrive v-else-if="info.icon === 'HardDrive'" class="h-4 w-4 text-muted-foreground mt-0.5" />
                <Cpu v-else-if="info.icon === 'Cpu'" class="h-4 w-4 text-muted-foreground mt-0.5" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-muted-foreground">{{ info.label }}</div>
                  <div class="text-sm break-all">{{ info.value }}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Activity Information -->
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <Calendar class="h-5 w-5" />
                Activity Information
              </CardTitle>
              <CardDescription>
                Registration and usage timestamps for this device
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div v-for="timestamp in deviceTimestamps" :key="timestamp.label" class="flex items-start gap-3">
                <Calendar class="h-4 w-4 text-muted-foreground mt-0.5" />
                <div class="flex-1">
                  <div class="text-sm font-medium text-muted-foreground">{{ timestamp.label }}</div>
                  <div class="text-sm">{{ formatTimestamp(timestamp.value) }}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Security Status -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Shield class="h-5 w-5" />
              Security Status
            </CardTitle>
            <CardDescription>
              Trust status and security information for this device
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-2">
                <Shield v-if="device.is_trusted" class="h-5 w-5 text-green-600" />
                <ShieldOff v-else class="h-5 w-5 text-yellow-600" />
                <div>
                  <div class="font-medium">
                    {{ device.is_trusted ? 'Trusted Device' : 'Untrusted Device' }}
                  </div>
                  <div class="text-sm text-muted-foreground">
                    {{ device.is_trusted 
                      ? 'This device is marked as trusted and has full access to your MCP configurations'
                      : 'This device requires additional verification for sensitive operations'
                    }}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Actions -->
        <div class="flex items-center gap-4 pt-4 border-t">
          <Button variant="destructive" class="flex items-center gap-2">
            <Trash2 class="h-4 w-4" />
            Remove Device
          </Button>
        </div>
      </div>
      </div>
    </ContentWrapper>
  </DashboardLayout>
</template>
