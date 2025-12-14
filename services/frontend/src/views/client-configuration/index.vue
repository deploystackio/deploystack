<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { DsCard } from '@/components/ui/ds-card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsMenu, SettingsMenuGroup, SettingsMenuItem, SettingsMenuSeparator } from '@/components/ui/settings-menu'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ServerOff } from 'lucide-vue-next'
import { GatewayConfigService, type ClientConfigResponse, type ConfigAction, type ClientInfo, type ClientCategory } from '@/services/satelliteConfigService'
import { SatelliteService, type TeamSatellite } from '@/services/satelliteService'
import { TeamService } from '@/services/teamService'
import LinkActionRenderer from '@/components/client-config/LinkActionRenderer.vue'
import StepsActionRenderer from '@/components/client-config/StepsActionRenderer.vue'
import CommandActionRenderer from '@/components/client-config/CommandActionRenderer.vue'
import JsonActionRenderer from '@/components/client-config/JsonActionRenderer.vue'
import TextActionRenderer from '@/components/client-config/TextActionRenderer.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// State
const clientCategories = ref<ClientCategory[]>([])
const supportedClients = ref<ClientInfo[]>([])
const selectedClient = ref<string>('')
const selectedCategory = ref<string>('')
const actions = ref<ConfigAction[]>([])
const isLoading = ref(true)
const isLoadingConfig = ref(false)
const error = ref<string | null>(null)

// Satellite state
const availableSatellites = ref<TeamSatellite[]>([])
const selectedSatelliteId = ref('')
const isLoadingSatellites = ref(false)

// Computed
const selectedClientFromRoute = computed(() => {
  return route.params.client as string | undefined
})

const selectedCategoryFromRoute = computed(() => {
  return route.params.category as string | undefined
})

// Separate actions into connection setup (non-text) and AI instructions (text)
const connectionActions = computed(() => {
  return actions.value.filter(action => action.type !== 'text')
})

const textActions = computed(() => {
  return actions.value.filter(action => action.type === 'text')
})

// Mobile select value (combined category:client format)
const mobileSelectValue = computed(() => {
  if (selectedCategory.value && selectedClient.value) {
    return `${selectedCategory.value}:${selectedClient.value}`
  }
  return undefined
})

// Handle mobile select change
function handleMobileSelectChange(value: unknown) {
  if (typeof value !== 'string') return
  const [category, client] = value.split(':')
  if (category && client) {
    router.push(`/client-configuration/${category}/${client}`)
  }
}

// Load supported clients
async function loadSupportedClients() {
  isLoading.value = true
  try {
    const categories = await GatewayConfigService.getClientCategoriesWithClients()

    // Sort clients alphabetically within each category
    const sortedCategories = categories.map(category => ({
      ...category,
      clients: [...category.clients].sort((a, b) => a.name.localeCompare(b.name))
    }))

    clientCategories.value = sortedCategories

    // Flatten to get all unique clients for lookups
    const allClients = new Map<string, ClientInfo>()
    for (const category of sortedCategories) {
      for (const client of category.clients) {
        allClients.set(client.id, client)
      }
    }
    supportedClients.value = Array.from(allClients.values())

    // If no route params and we have categories, redirect to first category and first client
    if (!selectedCategoryFromRoute.value && !selectedClientFromRoute.value && categories.length > 0) {
      const firstCategory = categories[0]
      const firstClient = firstCategory?.clients[0]
      if (firstCategory && firstClient) {
        router.replace(`/client-configuration/${firstCategory.id}/${firstClient.id}`)
      }
    } else if (selectedCategoryFromRoute.value && selectedClientFromRoute.value) {
      selectedCategory.value = selectedCategoryFromRoute.value
      selectedClient.value = selectedClientFromRoute.value
      await loadConfiguration(selectedCategoryFromRoute.value, selectedClientFromRoute.value)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load supported clients'
    toast.error(errorMessage)
  } finally {
    isLoading.value = false
  }
}

// Load available satellites for user's team
async function loadAvailableSatellites() {
  isLoadingSatellites.value = true
  try {
    // Get user's teams
    const userTeams = await TeamService.getUserTeams()

    if (!userTeams || userTeams.length === 0) {
      toast.error('No teams found for user')
      return
    }

    // Get user's first team (default team)
    const firstTeam = userTeams[0]
    if (!firstTeam) {
      toast.error('No default team found')
      return
    }

    const teamId = firstTeam.id
    const response = await SatelliteService.getTeamSatellites(teamId)

    // CRITICAL: Filter ONLY active satellites (status='active')
    availableSatellites.value = response.data.satellites.filter((s: TeamSatellite) => s.status === 'active')

    // Auto-select first satellite if only one or if none selected
    if (availableSatellites.value.length === 1) {
      const firstSatellite = availableSatellites.value[0]
      if (firstSatellite) {
        selectedSatelliteId.value = firstSatellite.id
      }
    } else if (availableSatellites.value.length > 0 && !selectedSatelliteId.value) {
      const firstSatellite = availableSatellites.value[0]
      if (firstSatellite) {
        selectedSatelliteId.value = firstSatellite.id
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load satellites'
    toast.error(errorMessage)
  } finally {
    isLoadingSatellites.value = false
  }
}

// Load configuration from API
async function loadConfiguration(category: string, client: string) {
  if (!selectedSatelliteId.value) {
    return
  }

  isLoadingConfig.value = true
  try {
    const response: ClientConfigResponse = await GatewayConfigService.getClientConfig(
      client,
      selectedSatelliteId.value,
      category
    )
    actions.value = response
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load configuration'
    toast.error(errorMessage)
    actions.value = []
  } finally {
    isLoadingConfig.value = false
  }
}

// Handle copy from action renderer components
async function handleCopy(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    toast.success(t('satelliteConfig.messages.copySuccess'))
  } catch {
    toast.error('Failed to copy to clipboard')
  }
}

// Handle link click from LinkActionRenderer
function handleLinkClick(action: { url: string; name?: string }) {
  if (action.url.startsWith('cursor://')) {
    window.location.href = action.url
  } else {
    window.open(action.url, '_blank')
  }
  toast.success(action.name || 'Installation link opened')
}

// Watch for route changes to load different client configurations
watch([selectedCategoryFromRoute, selectedClientFromRoute], async ([newCategory, newClient]) => {
  if (newCategory && newClient && (newCategory !== selectedCategory.value || newClient !== selectedClient.value)) {
    selectedCategory.value = newCategory
    selectedClient.value = newClient
    if (selectedSatelliteId.value) {
      await loadConfiguration(newCategory, newClient)
    }
  }
})

// Watch for satellite changes to reload current configuration
watch(selectedSatelliteId, async () => {
  if (selectedCategory.value && selectedClient.value) {
    await loadConfiguration(selectedCategory.value, selectedClient.value)
  }
})

onMounted(async () => {
  await loadAvailableSatellites()
  await loadSupportedClients()
})
</script>

<template>
  <NavbarLayout>
    <DsPageHeading :title="t('clientConfiguration.title')" />

    <!-- Main Content -->
    <div class="space-y-6 pb-16 mt-6">
      <!-- Mobile Navigation -->
      <div v-if="!isLoading" class="md:hidden">
        <Select :model-value="mobileSelectValue" @update:model-value="handleMobileSelectChange">
          <SelectTrigger class="w-full">
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup v-for="category in clientCategories" :key="category.id">
              <SelectLabel>{{ category.name }}</SelectLabel>
              <SelectItem
                v-for="client in category.clients"
                :key="client.id"
                :value="`${category.id}:${client.id}`"
              >
                <div class="flex items-center gap-2">
                  <img
                    v-if="client.iconPath"
                    :src="client.iconPath"
                    :alt="client.name"
                    class="w-4 h-4 object-contain"
                  />
                  <span>{{ client.name }}</span>
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div class="flex flex-col space-y-8 md:flex-row md:space-x-12 md:space-y-0 md:min-h-[calc(100vh-12rem)]">
        <!-- Desktop Sidebar Navigation -->
        <aside class="hidden md:block md:w-1/5 md:pr-8">
          <!-- Satellite Selection -->
          <div class="mb-6">
            <label class="text-sm font-medium mb-2 block md:pl-3">Select Satellite</label>
            <Select
              v-model="selectedSatelliteId"
              :disabled="isLoadingSatellites || availableSatellites.length === 0"
            >
              <SelectTrigger>
                <SelectValue
                  :placeholder="isLoadingSatellites ? 'Loading satellites...' : 'Select satellite'"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="satellite in availableSatellites"
                  :key="satellite.id"
                  :value="satellite.id"
                >
                  {{ satellite.name }}
                  <span class="text-xs text-muted-foreground ml-2">
                    ({{ satellite.satellite_type === 'global' ? 'Global' : 'Team' }})
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SettingsMenu v-if="!isLoading">
            <template v-for="(category, categoryIndex) in clientCategories" :key="category.id">
              <SettingsMenuGroup :title="category.name">
                <SettingsMenuItem
                  v-for="client in category.clients"
                  :key="client.id"
                  :to="`/client-configuration/${category.id}/${client.id}`"
                  :icon-url="client.iconPath"
                  :active="selectedClient === client.id && selectedCategory === category.id"
                >
                  {{ client.name }}
                </SettingsMenuItem>
              </SettingsMenuGroup>
              <SettingsMenuSeparator v-if="categoryIndex < clientCategories.length - 1" />
            </template>
          </SettingsMenu>
          <div v-else class="text-muted-foreground text-sm">
            {{ t('common.common.loading') }}
          </div>
        </aside>

        <!-- Content Area -->
        <div class="flex-1">
          <div v-if="isLoading" class="text-muted-foreground">
            {{ t('common.common.loading') }}
          </div>
          <div v-else-if="error" class="text-red-500">
            {{ t('common.messages.error') }}: {{ error }}
          </div>

          <!-- Client Configuration Content -->
          <div v-else-if="selectedClient" class="space-y-6">
            <!-- Loading State -->
            <div v-if="isLoadingConfig" class="text-center py-8 text-muted-foreground">
              {{ t('satelliteConfig.modal.loading') }}
            </div>

            <!-- No Satellites Available -->
            <Empty v-else-if="!isLoadingSatellites && availableSatellites.length === 0" class="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ServerOff class="h-12 w-12" />
                </EmptyMedia>
              </EmptyHeader>
              <EmptyTitle>No Satellites Available</EmptyTitle>
              <EmptyDescription>
                No active satellites available. Please contact your administrator to set up a satellite.
              </EmptyDescription>
            </Empty>

            <!-- Actions Rendering -->
            <template v-else>
              <!-- Connection Setup Actions -->
              <template v-for="(action, index) in connectionActions" :key="`conn-${index}`">
                <!-- Link Actions (One-Click Install) -->
                <DsCard v-if="action.type === 'link'" :title="action.name || 'Install'">
                  <p v-if="action.description" class="text-sm mb-4">{{ action.description }}</p>
                  <LinkActionRenderer :action="action" @click="handleLinkClick" />
                </DsCard>

                <!-- Steps Actions -->
                <DsCard v-else-if="action.type === 'steps'" :title="action.title || 'Steps'">
                  <p v-if="action.description" class="text-sm mb-4">{{ action.description }}</p>
                  <StepsActionRenderer :action="action" />
                </DsCard>

                <!-- Command Actions -->
                <DsCard v-else-if="action.type === 'command'" :title="action.title || 'Command'">
                  <p v-if="action.description" class="text-sm mb-4">{{ action.description }}</p>
                  <CommandActionRenderer
                    :action="action"
                    :hide-header="true"
                    :show-copy-button="false"
                  />
                  <template #footer-actions>
                    <Button @click="handleCopy(action.command)">
                      {{ t('satelliteConfig.button.copy') }}
                    </Button>
                  </template>
                </DsCard>

                <!-- JSON Actions -->
                <DsCard v-else-if="action.type === 'json'" :title="action.title || 'Configuration'">
                  <p v-if="action.description" class="text-sm mb-4">{{ action.description }}</p>
                  <JsonActionRenderer
                    :action="action"
                    :hide-header="true"
                    :show-copy-button="false"
                  />
                  <template #footer-actions>
                    <Button @click="handleCopy(action.jsonContent || JSON.stringify(action.servers || action.mcpServers || action.inputs, null, 2))">
                      {{ t('satelliteConfig.button.copy') }}
                    </Button>
                  </template>
                </DsCard>
              </template>


              <!-- Text Actions (AI Instructions) -->
              <template v-for="(action, index) in textActions" :key="`text-${index}`">
                <DsCard :title="action.title || 'Instructions'">
                  <p v-if="action.description" class="text-sm mb-4">{{ action.description }}</p>
                  <TextActionRenderer
                    :action="action"
                    :hide-header="true"
                    :show-copy-button="false"
                  />
                  <template #footer-actions>
                    <Button @click="handleCopy(action.content)">
                      {{ t('satelliteConfig.button.copy') }}
                    </Button>
                  </template>
                </DsCard>
              </template>
            </template>
          </div>

          <div v-else-if="!selectedClientFromRoute && supportedClients.length === 0">
            <p class="text-muted-foreground">{{ t('satelliteConfig.messages.noClients') }}</p>
          </div>
        </div>
      </div>
    </div>
  </NavbarLayout>
</template>
