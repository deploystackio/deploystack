<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle, Satellite, Check } from 'lucide-vue-next'
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
  'next': []
  'back': []
}>()

const { t } = useI18n()
const eventBus = useEventBus()

const satellites = ref<TeamSatellite[]>([])
const selectedSatelliteId = ref('')
const isLoading = ref(true)
const error = ref<string | null>(null)

const canProceed = computed(() => {
  return selectedSatelliteId.value !== ''
})

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

function handleNext() {
  if (!canProceed.value) return

  emit('update:modelValue', {
    satellite_id: selectedSatelliteId.value
  })
  emit('next')
}

function handleBack() {
  emit('back')
}

onMounted(() => {
  fetchSatellites()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3 mb-6">
      <Satellite class="h-6 w-6 text-primary" />
      <h2 class="text-2xl font-semibold">{{ t('deployments.wizard.steps.selectSatellite') }}</h2>
    </div>

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

      <div class="space-y-2">
        <Label>Available Satellites</Label>
        <div class="space-y-2">
          <div
            v-for="satellite in satellites"
            :key="satellite.id"
            class="relative flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-all"
            :class="{
              'border-primary bg-primary/5 ring-2 ring-primary/20': selectedSatelliteId === satellite.id,
              'hover:bg-accent': selectedSatelliteId !== satellite.id
            }"
            @click="selectedSatelliteId = satellite.id"
          >
            <div class="flex-1">
              <div class="flex items-center gap-3">
                <Satellite class="h-5 w-5 text-muted-foreground" />
                <div>
                  <p class="font-medium">{{ satellite.name }}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs px-2 py-0.5 rounded-full"
                          :class="satellite.satellite_type === 'global'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'">
                      {{ satellite.satellite_type }}
                    </span>
                    <span v-if="satellite.status === 'active'" class="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle class="h-3 w-3" />
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <Check
              v-if="selectedSatelliteId === satellite.id"
              class="h-5 w-5 text-primary"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-between pt-6">
      <Button @click="handleBack" variant="outline">
        {{ t('common.actions.back') }}
      </Button>
      <Button
        @click="handleNext"
        :disabled="!canProceed"
      >
        {{ t('common.actions.next') }}
      </Button>
    </div>
  </div>
</template>
