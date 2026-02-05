import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { SatelliteService, type Satellite } from '@/services/satelliteService'

export function useSatelliteCache() {
  const route = useRoute()
  const { t } = useI18n()
  const eventBus = useEventBus()
  const { setBreadcrumbs } = useBreadcrumbs()

  const satellite = ref<Satellite | null>(null)
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  const satelliteId = route.params.id as string
  const storageKeyName = `satellite_name_${satelliteId}`
  const storageKeyStatus = `satellite_status_${satelliteId}`

  async function loadAndSetSatellite() {
    try {
      isLoading.value = true
      const fetchedSatellite = await SatelliteService.getSatelliteById(satelliteId)

      satellite.value = fetchedSatellite
      error.value = null

      // Cache the satellite name and status for instant loading on tab switches
      eventBus.setState(storageKeyName, fetchedSatellite.name)
      eventBus.setState(storageKeyStatus, fetchedSatellite.status)

      // Update breadcrumbs with satellite name
      setBreadcrumbs([
        { label: t('satellites.title'), href: '/admin/satellites' },
        { label: fetchedSatellite.name }
      ])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load satellite'
      satellite.value = null

      // Clear cached data on error
      eventBus.clearState(storageKeyName)
      eventBus.clearState(storageKeyStatus)
    } finally {
      isLoading.value = false
    }
  }

  function initializeCache() {
    // Set initial breadcrumbs with loading state
    setBreadcrumbs([
      { label: t('satellites.title'), href: '/admin/satellites' },
      { label: t('satellites.manage.loading') }
    ])

    // Load cached satellite data immediately to prevent flicker
    const cachedName = eventBus.getState<string>(storageKeyName)
    const cachedStatus = eventBus.getState<Satellite['status']>(storageKeyStatus)

    if (cachedName && !satellite.value) {
      satellite.value = {
        name: cachedName,
        status: cachedStatus || 'inactive'
      } as Satellite
    }
  }

  function setupWatchers() {
    // Watch for satellite ID changes in route to clear cached data
    watch(
      () => route.params.id,
      (newId, oldId) => {
        if (newId && oldId && newId !== oldId) {
          // Clear old satellite's cached data
          const oldStorageKeyName = `satellite_name_${oldId}`
          const oldStorageKeyStatus = `satellite_status_${oldId}`
          eventBus.clearState(oldStorageKeyName)
          eventBus.clearState(oldStorageKeyStatus)

          // Reset satellite to null to trigger loading state
          satellite.value = null

          // Load new satellite
          loadAndSetSatellite()
        }
      }
    )

    // Watch satellite value changes to update cache
    watch(
      () => satellite.value,
      (newSatellite) => {
        if (newSatellite) {
          eventBus.setState(storageKeyName, newSatellite.name)
          eventBus.setState(storageKeyStatus, newSatellite.status)
        }
      },
      { deep: true }
    )
  }

  function cleanupWatchers() {
    // No specific cleanup needed - Vue handles watch cleanup automatically
    // This function exists for API consistency
  }

  function handleSatelliteUpdated(updatedSatellite: Satellite) {
    // Merge updated satellite data
    if (satellite.value) {
      satellite.value = {
        ...satellite.value,
        ...updatedSatellite
      }
    } else {
      satellite.value = updatedSatellite
    }
  }

  return {
    satellite,
    isLoading,
    error,
    satelliteId,
    loadAndSetSatellite,
    initializeCache,
    setupWatchers,
    cleanupWatchers,
    handleSatelliteUpdated
  }
}
