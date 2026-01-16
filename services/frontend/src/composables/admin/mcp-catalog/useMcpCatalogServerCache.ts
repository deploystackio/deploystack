import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useEventBus } from '@/composables/useEventBus'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { McpCatalogService } from '@/services/mcpCatalogService'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'

export function useMcpCatalogServerCache() {
  const route = useRoute()
  const { t } = useI18n()
  const eventBus = useEventBus()
  const { setBreadcrumbs } = useBreadcrumbs()

  const server = ref<McpServer | null>(null)
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  const serverId = route.params.id as string
  const storageKeyName = `mcp_catalog_server_name_${serverId}`
  const storageKeyIcon = `mcp_catalog_server_icon_${serverId}`

  async function loadAndSetServer() {
    try {
      isLoading.value = true
      const fetchedServer = await McpCatalogService.getServerById(serverId)

      server.value = fetchedServer
      error.value = null

      // Cache the server name for instant loading on tab switches
      eventBus.setState(storageKeyName, fetchedServer.name)

      // Cache the server icon data for instant loading on tab switches
      if (fetchedServer.icon_url) {
        eventBus.setState(storageKeyIcon, {
          icon_url: fetchedServer.icon_url,
          name: fetchedServer.name
        })
      }

      // Update breadcrumbs with server name
      setBreadcrumbs([
        { label: t('mcpCatalog.title'), href: '/admin/mcp-server-catalog' },
        { label: fetchedServer.name }
      ])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An unknown error occurred'
      server.value = null

      // Clear cached data on error
      eventBus.clearState(storageKeyName)
      eventBus.clearState(storageKeyIcon)
    } finally {
      isLoading.value = false
    }
  }

  function initializeCache() {
    // Set initial breadcrumbs with loading state
    setBreadcrumbs([
      { label: t('mcpCatalog.title'), href: '/admin/mcp-server-catalog' },
      { label: 'Loading...' }
    ])

    // Load cached server data immediately to prevent flicker
    const cachedName = eventBus.getState<string>(storageKeyName)
    const cachedIcon = eventBus.getState<{ icon_url: string; name: string }>(storageKeyIcon)

    if (cachedName && !server.value) {
      server.value = {
        name: cachedName,
        icon_url: cachedIcon?.icon_url
      } as McpServer
    }
  }

  function setupWatchers() {
    // Watch for server ID changes in route to clear cached data
    watch(
      () => route.params.id,
      (newId, oldId) => {
        if (newId && oldId && newId !== oldId) {
          // Clear old server's cached data
          const oldStorageKeyName = `mcp_catalog_server_name_${oldId}`
          const oldStorageKeyIcon = `mcp_catalog_server_icon_${oldId}`
          eventBus.clearState(oldStorageKeyName)
          eventBus.clearState(oldStorageKeyIcon)

          // Reset server to null to trigger loading state
          server.value = null

          // Load new server
          loadAndSetServer()
        }
      }
    )

    // Watch server value changes to update cache
    watch(
      () => server.value,
      (newServer) => {
        if (newServer) {
          eventBus.setState(storageKeyName, newServer.name)
          if (newServer.icon_url) {
            eventBus.setState(storageKeyIcon, {
              icon_url: newServer.icon_url,
              name: newServer.name
            })
          }
        }
      },
      { deep: true }
    )
  }

  function cleanupWatchers() {
    // No specific cleanup needed - Vue handles watch cleanup automatically
    // This function exists for API consistency
  }

  return {
    server,
    isLoading,
    error,
    serverId,
    loadAndSetServer,
    initializeCache,
    setupWatchers,
    cleanupWatchers
  }
}
