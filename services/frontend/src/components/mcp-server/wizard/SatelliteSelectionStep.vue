<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Globe, Users, Zap } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { SatelliteService, type TeamSatellite } from '@/services/satelliteService'

// Props
interface Props {
  satellites: TeamSatellite[]
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false
})

// Model for selected satellite ID
const modelValue = defineModel<string>({ required: true })

const { t } = useI18n()

// Group satellites by type
const globalSatellites = computed(() =>
  props.satellites.filter(s => s.satellite_type === 'global')
)

const teamSatellites = computed(() =>
  props.satellites.filter(s => s.satellite_type === 'team')
)

// Auto-select first satellite if none selected
onMounted(() => {
  if (!modelValue.value && props.satellites.length > 0) {
    modelValue.value = props.satellites[0]!.id
  }
})

// Helper to get icon for satellite type
const getIcon = (type: 'global' | 'team') => {
  return type === 'global' ? Globe : Users
}
</script>

<template>
  <div class="space-y-6">
    <!-- Step Header -->
    <div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        {{ t('mcpInstallations.wizard.satellite.title') }}
      </h2>
      <p class="text-gray-600">
        {{ t('mcpInstallations.wizard.satellite.description') }}
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-8">
      <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
        <span class="sr-only">{{ t('common.loading') }}</span>
      </div>
    </div>

    <!-- Satellite Selection -->
    <fieldset v-else :aria-label="t('mcpInstallations.wizard.satellite.title')">
      <div class="space-y-6">
        <!-- Global Satellites Section -->
        <div v-if="globalSatellites.length > 0">
          <h3 class="text-sm font-medium text-gray-900 mb-3">
            {{ t('mcpInstallations.wizard.satellite.globalSatellites') }}
          </h3>
          <div class="space-y-3">
            <div
              v-for="satellite in globalSatellites"
              :key="satellite.id"
              :class="[
                'group relative block rounded-lg border-1 px-6 py-4 cursor-pointer transition-all duration-200',
                'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2',
                modelValue === satellite.id
                  ? '!border-primary bg-muted/50'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              ]"
              @click="modelValue = satellite.id"
            >
              <input
                type="radio"
                name="satellite"
                :value="satellite.id"
                v-model="modelValue"
                class="sr-only"
              />

              <div class="flex items-start justify-between">
                <!-- Left Side: Icon + Info -->
                <div class="flex items-start gap-3">
                  <!-- Satellite Icon -->
                  <div :class="[
                    'p-2 rounded-lg transition-colors flex-shrink-0',
                    modelValue === satellite.id
                      ? 'bg-primary/10 text-primary'
                      : 'bg-gray-100 text-gray-600'
                  ]">
                    <component :is="getIcon(satellite.satellite_type)" class="h-5 w-5" />
                  </div>

                  <!-- Satellite Info -->
                  <div class="flex-1 min-w-0">
                    <!-- Name and Status -->
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-medium text-base text-gray-900">
                        {{ satellite.name }}
                      </span>
                      <Badge variant="default" class="text-xs">
                        {{ t('mcpInstallations.wizard.satellite.global') }}
                      </Badge>
                    </div>

                    <!-- Capabilities -->
                    <div class="flex flex-wrap gap-1.5 mb-2">
                      <Badge
                        v-for="capability in satellite.capabilities"
                        :key="capability"
                        variant="outline"
                        class="text-xs font-mono"
                      >
                        <Zap class="h-3 w-3 mr-1" />
                        {{ capability }}
                      </Badge>
                    </div>

                    <!-- Last Heartbeat -->
                    <div class="text-xs text-gray-500">
                      {{ t('mcpInstallations.wizard.satellite.lastHeartbeat') }}:
                      {{ SatelliteService.formatLastHeartbeat(satellite.last_heartbeat) }}
                    </div>
                  </div>
                </div>

                <!-- Selection Indicator -->
                <div
                  v-if="modelValue === satellite.id"
                  class="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center ml-4"
                >
                  <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Team Satellites Section -->
        <div v-if="teamSatellites.length > 0">
          <h3 class="text-sm font-medium text-gray-900 mb-3">
            {{ t('mcpInstallations.wizard.satellite.teamSatellites') }}
          </h3>
          <div class="space-y-3">
            <div
              v-for="satellite in teamSatellites"
              :key="satellite.id"
              :class="[
                'group relative block rounded-lg border-1 px-6 py-4 cursor-pointer transition-all duration-200',
                'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2',
                modelValue === satellite.id
                  ? '!border-primary bg-muted/50'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              ]"
              @click="modelValue = satellite.id"
            >
              <input
                type="radio"
                name="satellite"
                :value="satellite.id"
                v-model="modelValue"
                class="sr-only"
              />

              <div class="flex items-start justify-between">
                <!-- Left Side: Icon + Info -->
                <div class="flex items-start gap-3">
                  <!-- Satellite Icon -->
                  <div :class="[
                    'p-2 rounded-lg transition-colors flex-shrink-0',
                    modelValue === satellite.id
                      ? 'bg-primary/10 text-primary'
                      : 'bg-gray-100 text-gray-600'
                  ]">
                    <component :is="getIcon(satellite.satellite_type)" class="h-5 w-5" />
                  </div>

                  <!-- Satellite Info -->
                  <div class="flex-1 min-w-0">
                    <!-- Name and Status -->
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-medium text-base text-gray-900">
                        {{ satellite.name }}
                      </span>
                      <Badge variant="secondary" class="text-xs">
                        {{ t('mcpInstallations.wizard.satellite.team') }}
                      </Badge>
                    </div>

                    <!-- Capabilities -->
                    <div class="flex flex-wrap gap-1.5 mb-2">
                      <Badge
                        v-for="capability in satellite.capabilities"
                        :key="capability"
                        variant="outline"
                        class="text-xs font-mono"
                      >
                        <Zap class="h-3 w-3 mr-1" />
                        {{ capability }}
                      </Badge>
                    </div>

                    <!-- Last Heartbeat -->
                    <div class="text-xs text-gray-500">
                      {{ t('mcpInstallations.wizard.satellite.lastHeartbeat') }}:
                      {{ SatelliteService.formatLastHeartbeat(satellite.last_heartbeat) }}
                    </div>
                  </div>
                </div>

                <!-- Selection Indicator -->
                <div
                  v-if="modelValue === satellite.id"
                  class="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center ml-4"
                >
                  <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="!isLoading && satellites.length === 0" class="text-center py-8 text-gray-500">
          {{ t('mcpInstallations.wizard.satellite.noSatellites') }}
        </div>
      </div>
    </fieldset>
  </div>
</template>
