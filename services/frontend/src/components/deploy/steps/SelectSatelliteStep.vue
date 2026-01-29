<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { RadioCard, RadioCardGroup } from '@/components/ui/radio-card'
import { SatelliteService, type TeamSatellite } from '@/services/satelliteService'
import { useEventBus } from '@/composables/useEventBus'
import { toast } from 'vue-sonner'

interface SatelliteSelection {
  satellite_id: string
}

const props = defineProps<{
  modelValue?: SatelliteSelection
}>()

const emit = defineEmits<{
  'update:modelValue': [value: SatelliteSelection]
}>()

const { t } = useI18n()
const eventBus = useEventBus()

const satellites = ref<TeamSatellite[]>([])
const selectedSatelliteId = ref('')
const isLoading = ref(true)
const error = ref<string | null>(null)

async function fetchSatellites() {
  try {
    isLoading.value = true
    error.value = null

    const teamId = eventBus.getState<string>('selected_team_id')
    if (!teamId) {
      throw new Error('No team selected')
    }

    const response = await SatelliteService.getTeamSatellites(teamId)
    satellites.value = response.data.satellites

    // Auto-select if only one satellite
    if (satellites.value.length === 1) {
      selectedSatelliteId.value = satellites.value[0]!.id
    }

    // Restore previous selection if available
    if (props.modelValue?.satellite_id) {
      selectedSatelliteId.value = props.modelValue.satellite_id
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load satellites'
    toast.error('Failed to load satellites')
  } finally {
    isLoading.value = false
  }
}

// Watch for changes and emit to parent
watch(selectedSatelliteId, (newValue) => {
  if (newValue) {
    emit('update:modelValue', {
      satellite_id: newValue
    })
  }
})

onMounted(() => {
  fetchSatellites()
})
</script>

<template>
  <div>
    <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Spinner class="h-8 w-8" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4">
      <p class="text-sm text-red-600">{{ error }}</p>
      <Button @click="fetchSatellites" variant="outline" size="sm" class="mt-3">
        Retry
      </Button>
    </div>

    <!-- No Satellites -->
    <div v-else-if="satellites.length === 0" class="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <p class="text-sm text-yellow-600">No satellites available. Please add a satellite first.</p>
    </div>

    <!-- Satellite Selection -->
    <div v-else class="space-y-4">
      <p class="text-sm text-muted-foreground">
        {{ t('deployments.wizard.stepDescriptions.selectSatellite') }}
      </p>

      <RadioCardGroup v-model="selectedSatelliteId" name="satellite-selection">
        <RadioCard
          v-for="satellite in satellites"
          :key="satellite.id"
          :value="satellite.id"
        >
          <template #title>{{ satellite.name }}</template>
          <template #description>
            <span class="text-xs px-2 py-0.5 rounded-full"
                  :class="satellite.satellite_type === 'global'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'">
              {{ satellite.satellite_type }}
            </span>
          </template>
        </RadioCard>
      </RadioCardGroup>
    </div>
    </div>
  </div>
</template>
