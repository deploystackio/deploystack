<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { Skeleton } from '@/components/ui/skeleton'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { SatelliteManageHeader, SatelliteManageTabs, SatelliteInfo } from '@/components/admin/satellites'
import { useSatelliteCache } from '@/composables/satellites/useSatelliteCache'

const {
  satellite,
  isLoading,
  error,
  satelliteId,
  loadAndSetSatellite,
  initializeCache,
  setupWatchers,
  cleanupWatchers,
  handleSatelliteUpdated
} = useSatelliteCache()

onMounted(async () => {
  initializeCache()
  await loadAndSetSatellite()
  setupWatchers()
})

onUnmounted(() => {
  cleanupWatchers()
})
</script>

<template>
  <NavbarLayout>
    <SatelliteManageHeader
      :satellite="satellite"
      :is-loading="isLoading"
      @satellite-updated="handleSatelliteUpdated"
    />

    <div class="space-y-6 mt-6">
      <SatelliteManageTabs v-if="satellite" :satellite="satellite" :satellite-id="satelliteId">
        <div v-if="error" class="text-red-500">{{ error }}</div>

        <div v-else-if="isLoading" class="space-y-4">
          <Skeleton class="h-32 w-full rounded-lg" />
          <Skeleton class="h-32 w-full rounded-lg" />
        </div>

        <SatelliteInfo
          v-else
          :satellite="satellite"
          @satellite-updated="handleSatelliteUpdated"
        />
      </SatelliteManageTabs>
    </div>
  </NavbarLayout>
</template>
