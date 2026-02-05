<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Hash, Server, Cpu, HardDrive } from 'lucide-vue-next'
import { SatelliteService, type Satellite } from '@/services/satelliteService'
import { DsCard } from '@/components/ui/ds-card'
import { toast } from 'vue-sonner'

const { t } = useI18n()

interface Props {
  satellite: Satellite
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'satellite-updated': [satellite: Satellite]
}>()

// Available capabilities (MCP server types)
const availableCapabilities = [
  'stdio',
  'http',
  'sse'
]

// Dialog state
const showCapabilitiesDialog = ref(false)
const selectedCapabilities = ref<string[]>([])

// Form state
const satelliteName = ref(props.satellite.name)
const satelliteUrl = ref(props.satellite.satellite_url || '')
const satelliteRegion = ref(props.satellite.region || '')
const isUpdating = ref(false)

// Watch for satellite prop changes to update local values
watch(() => props.satellite.name, (newName) => {
  satelliteName.value = newName
})

watch(() => props.satellite.satellite_url, (newUrl) => {
  satelliteUrl.value = newUrl || ''
})

watch(() => props.satellite.region, (newRegion) => {
  satelliteRegion.value = newRegion || ''
})

// Initialize selected capabilities when dialog opens
function openCapabilitiesDialog() {
  selectedCapabilities.value = [...(props.satellite.capabilities || [])]
  showCapabilitiesDialog.value = true
}

// Handle capability toggle
function toggleCapability(capability: string) {
  const index = selectedCapabilities.value.indexOf(capability)
  if (index > -1) {
    selectedCapabilities.value.splice(index, 1)
  } else {
    selectedCapabilities.value.push(capability)
  }
}

// Handle save all fields
async function handleSave() {
  const trimmedName = satelliteName.value.trim()
  const trimmedUrl = satelliteUrl.value.trim()
  const trimmedRegion = satelliteRegion.value.trim()

  // Validate name
  if (!trimmedName) {
    toast.error(t('satellites.manage.info.errorTitle'), {
      description: t('satellites.manage.info.nameErrorEmpty')
    })
    return
  }

  // Validate URL
  if (!trimmedUrl) {
    toast.error(t('satellites.manage.info.errorTitle'), {
      description: t('satellites.manage.info.urlErrorEmpty')
    })
    return
  }

  try {
    isUpdating.value = true
    const response = await SatelliteService.updateSatellite(props.satellite.id, {
      name: trimmedName,
      satellite_url: trimmedUrl,
      region: trimmedRegion || null
    })

    // Emit updated satellite
    emit('satellite-updated', response.data)

    // Show success toast
    toast.success(t('satellites.manage.info.successTitle'), {
      description: t('satellites.manage.info.successDescription')
    })
  } catch (error) {
    toast.error(t('satellites.manage.info.errorTitle'), {
      description: error instanceof Error ? error.message : t('satellites.manage.info.errorDescription')
    })
  } finally {
    isUpdating.value = false
  }
}

// Handle save capabilities
async function handleSaveCapabilities() {
  try {
    isUpdating.value = true
    const response = await SatelliteService.updateSatellite(props.satellite.id, {
      capabilities: selectedCapabilities.value
    })

    // Emit updated satellite
    emit('satellite-updated', response.data)

    // Close dialog
    showCapabilitiesDialog.value = false

    // Show success toast
    toast.success(t('satellites.manage.capabilities.successTitle'), {
      description: t('satellites.manage.capabilities.successDescription')
    })
  } catch (error) {
    toast.error(t('satellites.manage.capabilities.errorTitle'), {
      description: error instanceof Error ? error.message : t('satellites.manage.capabilities.errorDescription')
    })
  } finally {
    isUpdating.value = false
  }
}

// Computed properties
const formattedCreatedDate = computed(() => {
  if (!props.satellite.created_at) return ''
  return new Date(props.satellite.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})

const hasCapabilities = computed(() => {
  return props.satellite.capabilities && props.satellite.capabilities.length > 0
})

const hasTeam = computed(() => {
  return props.satellite.team !== null && props.satellite.team !== undefined
})
</script>

<template>
  <div class="space-y-6">
    <!-- Satellite Information -->
    <DsCard :title="t('satellites.manage.info.title')">
      <dl class="divide-y divide-gray-100">
        <!-- Name -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">
            {{ t('satellites.manage.info.name') }}
          </dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <Input v-model="satelliteName" :placeholder="t('satellites.manage.info.namePlaceholder')" />
          </dd>
        </div>

        <!-- Satellite URL -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">
            {{ t('satellites.manage.info.satelliteUrl') }}
          </dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <Input
              v-model="satelliteUrl"
              :placeholder="t('satellites.manage.info.satelliteUrlPlaceholder')"
              type="url"
            />
          </dd>
        </div>

        <!-- Region -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">
            {{ t('satellites.manage.info.region') }}
          </dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <Input
              v-model="satelliteRegion"
              :placeholder="t('satellites.manage.info.regionPlaceholder')"
            />
          </dd>
        </div>

        <!-- Type -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">
            {{ t('satellites.manage.info.type') }}
          </dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <Badge :variant="satellite.satellite_type === 'global' ? 'default' : 'secondary'">
              {{ t(`satellites.type.${satellite.satellite_type}`) }}
            </Badge>
          </dd>
        </div>

        <!-- Created By -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">
            {{ t('satellites.manage.info.createdBy') }}
          </dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ satellite.created_by_user.username }}
            <span class="text-muted-foreground">({{ satellite.created_by_user.email }})</span>
          </dd>
        </div>

        <!-- Created At -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">
            {{ t('satellites.manage.info.createdAt') }}
          </dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ formattedCreatedDate }}
          </dd>
        </div>

        <!-- Satellite ID -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
            <Hash class="h-4 w-4 text-muted-foreground" />
            ID
          </dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <span class="font-mono text-xs">{{ satellite.id }}</span>
          </dd>
        </div>
      </dl>

      <template #footer-actions>
        <Button @click="handleSave" :disabled="isUpdating">
          <Spinner v-if="isUpdating" class="mr-2 h-4 w-4" />
          {{ t('satellites.manage.info.save') }}
        </Button>
      </template>
    </DsCard>

    <!-- System Information -->
    <DsCard v-if="satellite.system_info" :title="t('satellites.manage.info.systemInfo')">
      <dl class="divide-y divide-gray-100">
        <!-- Operating System -->
        <div v-if="satellite.system_info.os" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
            <Server class="h-4 w-4 text-muted-foreground" />
            {{ t('satellites.manage.info.os') }}
          </dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ satellite.system_info.os }}
          </dd>
        </div>

        <!-- Architecture -->
        <div v-if="satellite.system_info.arch" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
            <Cpu class="h-4 w-4 text-muted-foreground" />
            {{ t('satellites.manage.info.arch') }}
          </dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ satellite.system_info.arch }}
          </dd>
        </div>

        <!-- Node Version -->
        <div v-if="satellite.system_info.node_version" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
            <Server class="h-4 w-4 text-muted-foreground" />
            Node Version
          </dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ satellite.system_info.node_version }}
          </dd>
        </div>

        <!-- Memory -->
        <div v-if="satellite.system_info.memory_mb" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
            <HardDrive class="h-4 w-4 text-muted-foreground" />
            {{ t('satellites.manage.info.memory') }}
          </dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ satellite.system_info.memory_mb }} MB
          </dd>
        </div>
      </dl>
    </DsCard>

    <!-- Capabilities -->
    <DsCard :title="t('satellites.manage.info.capabilities')">
      <div v-if="hasCapabilities" class="flex flex-wrap gap-2">
        <Badge v-for="capability in satellite.capabilities" :key="capability" variant="secondary">
          {{ capability }}
        </Badge>
      </div>
      <p v-else class="text-sm text-muted-foreground">
        {{ t('satellites.manage.info.noCapabilities') }}
      </p>

      <template #footer-actions>
        <Button @click="openCapabilitiesDialog">
          {{ t('satellites.manage.capabilities.edit') }}
        </Button>
      </template>
    </DsCard>

    <!-- Capabilities Edit Dialog -->
    <Dialog v-model:open="showCapabilitiesDialog">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{{ t('satellites.manage.capabilities.dialogTitle') }}</DialogTitle>
          <DialogDescription>
            {{ t('satellites.manage.capabilities.dialogDescription') }}
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <div class="flex flex-col gap-4">
            <Label
              v-for="capability in availableCapabilities"
              :key="capability"
              :for="`capability-${capability}`"
              class="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 cursor-pointer has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950"
            >
              <Checkbox
                :id="`capability-${capability}`"
                :checked="selectedCapabilities.includes(capability)"
                @update:checked="toggleCapability(capability)"
                class="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
              />
              <div class="grid gap-1.5 font-normal">
                <p class="text-sm leading-none font-medium">
                  {{ capability.toUpperCase() }}
                </p>
                <p class="text-muted-foreground text-sm">
                  {{ t(`satellites.manage.capabilities.descriptions.${capability}`) }}
                </p>
              </div>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <DialogClose as-child>
            <Button variant="outline">
              {{ t('satellites.manage.capabilities.cancel') }}
            </Button>
          </DialogClose>
          <Button @click="handleSaveCapabilities" :disabled="isUpdating">
            <Spinner v-if="isUpdating" class="mr-2" />
            {{ t('satellites.manage.capabilities.save') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Team Assignment (only for team satellites) -->
    <DsCard v-if="satellite.satellite_type === 'team'" :title="t('satellites.manage.info.teamAssignment')">
      <div v-if="hasTeam">
        <dl class="divide-y divide-gray-100">
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900">
              {{ t('satellites.manage.info.team') }}
            </dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <RouterLink
                :to="`/teams/manage/${satellite.team!.id}/general`"
                class="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {{ satellite.team!.name }}
              </RouterLink>
              <span class="text-muted-foreground ml-2">({{ satellite.team!.slug }})</span>
            </dd>
          </div>
        </dl>
      </div>
      <p v-else class="text-sm text-muted-foreground">
        {{ t('satellites.manage.info.noTeam') }}
      </p>
    </DsCard>
  </div>
</template>
