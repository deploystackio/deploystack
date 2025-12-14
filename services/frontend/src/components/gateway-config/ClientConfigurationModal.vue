<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Field,
  FieldLabel,
} from '@/components/ui/field'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle } from 'lucide-vue-next'
import { GatewayConfigService, type ClientConfigResponse, type ClientInfo, type ConfigAction } from '@/services/satelliteConfigService'
import { SatelliteService, type TeamSatellite } from '@/services/satelliteService'
import { TeamService } from '@/services/teamService'
import { toast } from 'vue-sonner'
import LinkActionRenderer from '@/components/client-config/LinkActionRenderer.vue'
import StepsActionRenderer from '@/components/client-config/StepsActionRenderer.vue'
import CommandActionRenderer from '@/components/client-config/CommandActionRenderer.vue'
import JsonActionRenderer from '@/components/client-config/JsonActionRenderer.vue'

interface Props {
  open: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()

// State
const availableSatellites = ref<TeamSatellite[]>([])
const selectedSatelliteId = ref('')
const isLoadingSatellites = ref(false)
const selectedClient = ref('')
const actions = ref<ConfigAction[]>([])
const isLoading = ref(false)
const supportedClients = ref<ClientInfo[]>([])
const isLoadingClients = ref(false)
const isCopying = ref(false)

// Computed: Check if current actions have copyable content (JSON or command)
const hasCopyableContent = computed(() => {
  return actions.value.some(action => action.type === 'json' || action.type === 'command')
})

// Computed: Get the content to copy
const copyableContent = computed(() => {
  const action = actions.value.find(a => a.type === 'json' || a.type === 'command')
  if (!action) return ''

  if (action.type === 'command') {
    return action.command
  }

  if (action.type === 'json') {
    // Use pre-formatted jsonContent if available
    if (action.jsonContent) {
      return action.jsonContent
    }
    // Otherwise format the data fields
    const data = action.servers || action.mcpServers || action.inputs
    return JSON.stringify(data, null, 2)
  }

  return ''
})

// Load supported clients and satellites when modal opens
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    await loadAvailableSatellites()
    if (supportedClients.value.length === 0) {
      await loadSupportedClients()
    }
  }
})

// Reload configuration when satellite changes
watch(selectedSatelliteId, async () => {
  if (selectedClient.value && selectedSatelliteId.value) {
    await loadConfiguration(selectedClient.value)
  }
})

// Load configuration when client changes
watch(selectedClient, async (newClient) => {
  if (newClient && selectedSatelliteId.value) {
    await loadConfiguration(newClient)
  }
})

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
    // Inactive, maintenance, and error satellites are hidden from selection
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

// Load supported clients from API
async function loadSupportedClients() {
  isLoadingClients.value = true
  try {
    const clients = await GatewayConfigService.getSupportedClients()
    supportedClients.value = clients
    // Set first client as default if no client is selected
    if (!selectedClient.value && clients.length > 0) {
      const firstClient = clients[0]
      if (firstClient) {
        selectedClient.value = firstClient.id
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load supported clients'
    toast.error(errorMessage)
  } finally {
    isLoadingClients.value = false
  }
}

// Load configuration from API (only connection category)
async function loadConfiguration(client: string) {
  if (!selectedSatelliteId.value) {
    toast.error('Please select a satellite first')
    return
  }

  isLoading.value = true
  try {
    const response: ClientConfigResponse = await GatewayConfigService.getClientConfig(
      client,
      selectedSatelliteId.value,
      'connection'
    )
    actions.value = response
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load configuration'
    toast.error(errorMessage)
    actions.value = []
  } finally {
    isLoading.value = false
  }
}

function handleClose() {
  emit('update:open', false)
}

// Handle copy and close
async function handleCopyAndClose() {
  if (!copyableContent.value) {
    toast.error('No content to copy')
    return
  }

  isCopying.value = true

  try {
    await navigator.clipboard.writeText(copyableContent.value)
    handleClose()
    // Show success toast after modal closes
    setTimeout(() => {
      toast.success(t('satelliteConfig.messages.copySuccess'))
    }, 100)
  } catch {
    toast.error('Failed to copy to clipboard')
  } finally {
    isCopying.value = false
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
</script>

<template>
  <AlertDialog :open="props.open" @update:open="(value) => emit('update:open', value)">
    <AlertDialogContent class="max-w-4xl max-h-[75vh] overflow-y-auto">
      <AlertDialogHeader class="pb-4">
        <AlertDialogTitle class="text-xl font-semibold">
          {{ t('satelliteConfig.modal.title') }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('satelliteConfig.modal.description') }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div class="space-y-6">
        <!-- Client and Satellite Selection - Side by Side on Desktop -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Client Selection (LEFT) -->
          <Field>
            <FieldLabel for="client-select">{{ t('satelliteConfig.modal.clientLabel') }}</FieldLabel>
            <Select
              v-model="selectedClient"
              :disabled="!selectedSatelliteId || isLoadingClients || supportedClients.length === 0"
            >
              <SelectTrigger id="client-select">
                <SelectValue
                  :placeholder="
                    !selectedSatelliteId
                      ? 'Select a satellite first'
                      : isLoadingClients
                      ? 'Loading clients...'
                      : t('satelliteConfig.modal.selectPlaceholder')
                  "
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="client in supportedClients"
                  :key="client.id"
                  :value="client.id"
                >
                  {{ client.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <!-- Satellite Selection (RIGHT) -->
          <Field>
            <FieldLabel for="satellite-select">Select Satellite</FieldLabel>
            <Select
              v-model="selectedSatelliteId"
              :disabled="isLoadingSatellites || availableSatellites.length === 0"
            >
              <SelectTrigger id="satellite-select">
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
          </Field>
        </div>

        <!-- No Satellites Available Alert -->
        <Alert v-if="!isLoadingSatellites && availableSatellites.length === 0">
          <AlertCircle class="h-4 w-4 text-destructive" />
          <AlertTitle>No Satellites Available</AlertTitle>
          <AlertDescription>
            No active satellites available. Please contact your administrator.
          </AlertDescription>
        </Alert>

        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-8 text-muted-foreground">
          {{ t('satelliteConfig.modal.loading') }}
        </div>

        <!-- Actions Rendering -->
        <div v-else-if="availableSatellites.length > 0" class="space-y-6">
          <template v-for="(action, index) in actions" :key="index">
            <!-- Link Actions (One-Click Install) -->
            <div v-if="action.type === 'link'" class="space-y-2">
              <label v-if="action.name" class="text-sm font-medium">{{ action.name }}</label>
              <p v-if="action.description" class="text-sm text-muted-foreground">{{ action.description }}</p>
              <LinkActionRenderer :action="action" @click="handleLinkClick" />
            </div>

            <!-- Steps Actions -->
            <div v-else-if="action.type === 'steps'" class="space-y-2">
              <label v-if="action.title" class="text-sm font-medium">{{ action.title }}</label>
              <p v-if="action.description" class="text-sm text-muted-foreground">{{ action.description }}</p>
              <StepsActionRenderer :action="action" />
            </div>

            <!-- Command Actions -->
            <CommandActionRenderer
              v-else-if="action.type === 'command'"
              :action="action"
              :show-copy-button="false"
            />

            <!-- JSON Actions -->
            <JsonActionRenderer
              v-else-if="action.type === 'json'"
              :action="action"
              :show-copy-button="false"
            />
          </template>
        </div>
      </div>

      <AlertDialogFooter class="mt-6">
        <Button @click="handleClose" variant="outline">
          {{ t('actions.close') }}
        </Button>
        <Button
          v-if="hasCopyableContent"
          @click="handleCopyAndClose"
          :disabled="isCopying || !copyableContent || isLoading || isLoadingClients"
        >
          <Spinner v-if="isCopying" class="mr-2" />
          {{ t('satelliteConfig.button.copyAndClose') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
