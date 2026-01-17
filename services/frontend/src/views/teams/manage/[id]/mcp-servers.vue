<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { AlertCircle, ChevronRight, ChevronDown, Package } from 'lucide-vue-next'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { TeamManageHeader, TeamManageTabs } from '@/components/teams/manage'
import { useTeamCache } from '@/composables/teams/useTeamCache'
import { useEventBus } from '@/composables/useEventBus'
import { TeamService, type TeamMcpInstallation } from '@/services/teamService'
import { McpInstanceService } from '@/services/mcpInstanceService'
import type { McpInstance } from '@/types/mcp-instances'

const router = useRouter()
const eventBus = useEventBus()

const {
  team,
  isLoading: isLoadingTeam,
  error: teamError,
  teamId,
  loadAndSetTeam,
  initializeCache,
  setupWatchers,
  cleanupWatchers
} = useTeamCache()

// MCP installations state
const installations = ref<TeamMcpInstallation[]>([])
const isLoadingInstallations = ref(true)
const installationsError = ref<string | null>(null)

// Track expanded rows
const expandedRows = ref<Set<string>>(new Set())

// Track instances per installation
const instancesMap = ref<Map<string, McpInstance[]>>(new Map())
const instancesLoadingMap = ref<Map<string, boolean>>(new Map())
const instancesErrorMap = ref<Map<string, string>>(new Map())

// Computed loading state
const isLoading = computed(() => isLoadingTeam.value || isLoadingInstallations.value)
const error = computed(() => teamError.value || installationsError.value)

// Handle team selection from sidebar
const handleTeamSelected = (data: { teamId: string; teamName: string }) => {
  if (data.teamId !== teamId) {
    router.push(`/teams/manage/${data.teamId}/mcp-servers`)
  }
}

// Load MCP installations
async function loadInstallations() {
  isLoadingInstallations.value = true
  installationsError.value = null

  try {
    installations.value = await TeamService.getTeamMcpInstallations(teamId)
  } catch (err) {
    installationsError.value = err instanceof Error ? err.message : 'Failed to load MCP servers'
    installations.value = []
  } finally {
    isLoadingInstallations.value = false
  }
}

// Format date
function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString()
}

// Format date with time
function formatDateTime(dateString: string | null): string {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleString()
}

// Get instance status badge variant
function getInstanceStatusBadgeVariant(status: string) {
  switch (status) {
    case 'online':
      return 'default'
    case 'error':
    case 'permanently_failed':
    case 'requires_reauth':
      return 'destructive'
    case 'provisioning':
    case 'command_received':
    case 'connecting':
    case 'discovering_tools':
    case 'syncing_tools':
    case 'restarting':
      return 'outline'
    default:
      return 'secondary'
  }
}

// Get instance status badge class
function getInstanceStatusBadgeClass(status: string) {
  switch (status) {
    case 'online':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'error':
    case 'permanently_failed':
    case 'requires_reauth':
      return ''
    case 'provisioning':
    case 'command_received':
    case 'connecting':
    case 'discovering_tools':
    case 'syncing_tools':
    case 'restarting':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    case 'offline':
    case 'awaiting_user_config':
      return 'bg-neutral-50 text-neutral-700 border-neutral-200'
    default:
      return ''
  }
}

// Toggle row expansion
async function toggleRow(installationId: string) {
  if (expandedRows.value.has(installationId)) {
    expandedRows.value.delete(installationId)
  } else {
    expandedRows.value.add(installationId)

    // Fetch instances if not already loaded
    if (!instancesMap.value.has(installationId)) {
      await loadInstances(installationId)
    }
  }
}

// Load instances for a specific installation
async function loadInstances(installationId: string) {
  instancesLoadingMap.value.set(installationId, true)
  instancesErrorMap.value.delete(installationId)

  try {
    const instances = await McpInstanceService.getInstallationInstances(teamId, installationId)
    instancesMap.value.set(installationId, instances)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load instances'
    instancesErrorMap.value.set(installationId, errorMessage)
    instancesMap.value.set(installationId, [])
  } finally {
    instancesLoadingMap.value.set(installationId, false)
  }
}

// Load data on component mount
onMounted(async () => {
  initializeCache()
  await loadAndSetTeam()
  setupWatchers()
  await loadInstallations()

  // Listen for team selection events from sidebar
  eventBus.on('team-selected', handleTeamSelected)
})

onUnmounted(() => {
  cleanupWatchers()
  eventBus.off('team-selected', handleTeamSelected)
})
</script>

<template>
  <NavbarLayout>
    <TeamManageHeader :team="team" :is-loading="isLoadingTeam" />

    <div class="space-y-6 mt-6">
      <!-- Tabs - Always visible when team is loaded -->
      <TeamManageTabs v-if="team" :team="team" :team-id="teamId">
        <!-- Error State -->
        <Alert v-if="error" variant="destructive" class="mb-6">
          <AlertCircle class="h-4 w-4" />
          <AlertDescription>
            {{ error }}
          </AlertDescription>
        </Alert>

        <!-- Loading State for Content -->
        <div v-else-if="isLoading" class="space-y-4">
          <Skeleton class="h-32 w-full rounded-lg" />
          <Skeleton class="h-32 w-full rounded-lg" />
          <Skeleton class="h-32 w-full rounded-lg" />
        </div>

        <!-- Empty State -->
        <Empty v-else-if="installations.length === 0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package />
            </EmptyMedia>
            <EmptyTitle>No MCP servers installed</EmptyTitle>
            <EmptyDescription>
              This team has not installed any MCP servers yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>

        <!-- MCP Installations Table -->
        <div v-else class="space-y-4">
          <div class="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Runtime</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-for="installation in installations" :key="installation.id">
                  <!-- Main Installation Row -->
                  <TableRow
                    class="cursor-pointer hover:bg-muted/50"
                    @click="toggleRow(installation.id)"
                  >
                    <!-- Chevron Column -->
                    <TableCell>
                      <ChevronRight v-if="!expandedRows.has(installation.id)" class="h-4 w-4" />
                      <ChevronDown v-else class="h-4 w-4" />
                    </TableCell>

                    <!-- Name -->
                    <TableCell>
                      <span class="font-medium">{{ installation.installation_name }}</span>
                    </TableCell>

                    <!-- Type -->
                    <TableCell>
                      <Badge variant="outline" class="text-xs">
                        {{ installation.installation_type }}
                      </Badge>
                    </TableCell>

                    <!-- Runtime -->
                    <TableCell>
                      <span class="text-sm text-muted-foreground">{{ installation.server.runtime }}</span>
                    </TableCell>

                    <!-- Created -->
                    <TableCell>
                      <span class="text-sm">{{ formatDate(installation.created_at) }}</span>
                    </TableCell>

                    <!-- Last Used -->
                    <TableCell>
                      <span class="text-sm text-muted-foreground">{{ formatDate(installation.last_used_at) }}</span>
                    </TableCell>
                  </TableRow>

                  <!-- Expanded Detail Row -->
                  <TableRow v-if="expandedRows.has(installation.id)" class="bg-muted/30">
                    <TableCell colspan="6" class="p-6">
                      <!-- Loading State -->
                      <div v-if="instancesLoadingMap.get(installation.id)" class="space-y-2">
                        <Skeleton class="h-4 w-32 mb-2" />
                        <div class="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead class="text-xs">Username</TableHead>
                                <TableHead class="text-xs">Email</TableHead>
                                <TableHead class="text-xs">Status</TableHead>
                                <TableHead class="text-xs">Status Message</TableHead>
                                <TableHead class="text-xs">Last Health Check</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow v-for="i in 3" :key="i">
                                <TableCell><Skeleton class="h-4 w-20" /></TableCell>
                                <TableCell><Skeleton class="h-4 w-40" /></TableCell>
                                <TableCell><Skeleton class="h-5 w-16" /></TableCell>
                                <TableCell><Skeleton class="h-4 w-32" /></TableCell>
                                <TableCell><Skeleton class="h-4 w-32" /></TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      <!-- Error State -->
                      <Alert v-else-if="instancesErrorMap.has(installation.id)" variant="destructive">
                        <AlertCircle class="h-4 w-4" />
                        <AlertDescription>
                          {{ instancesErrorMap.get(installation.id) }}
                        </AlertDescription>
                      </Alert>

                      <!-- Empty State -->
                      <div v-else-if="instancesMap.get(installation.id)?.length === 0" class="text-sm text-muted-foreground text-center py-4">
                        No instances found for this installation.
                      </div>

                      <!-- Instances Table -->
                      <div v-else class="space-y-2">
                        <div class="text-xs font-semibold text-muted-foreground mb-2">
                          User Instances ({{ instancesMap.get(installation.id)?.length || 0 }})
                        </div>
                        <div class="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead class="text-xs">Username</TableHead>
                                <TableHead class="text-xs">Email</TableHead>
                                <TableHead class="text-xs">Status</TableHead>
                                <TableHead class="text-xs">Status Message</TableHead>
                                <TableHead class="text-xs">Last Health Check</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow
                                v-for="instance in instancesMap.get(installation.id)"
                                :key="instance.id"
                              >
                                <!-- Username -->
                                <TableCell class="text-xs font-medium">
                                  {{ instance.user_slug }}
                                </TableCell>

                                <!-- Email -->
                                <TableCell class="text-xs text-muted-foreground">
                                  {{ instance.user_email }}
                                </TableCell>

                                <!-- Status -->
                                <TableCell>
                                  <Badge
                                    :variant="getInstanceStatusBadgeVariant(instance.status)"
                                    :class="getInstanceStatusBadgeClass(instance.status)"
                                    class="text-xs"
                                  >
                                    {{ instance.status }}
                                  </Badge>
                                </TableCell>

                                <!-- Status Message -->
                                <TableCell class="text-xs text-muted-foreground">
                                  {{ instance.status_message || '-' }}
                                </TableCell>

                                <!-- Last Health Check -->
                                <TableCell class="text-xs">
                                  {{ formatDateTime(instance.last_health_check_at) }}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
          </div>

          <!-- Results Counter -->
          <div class="flex items-center justify-between px-4 py-4">
            <div class="flex-1 text-sm text-muted-foreground">
              {{ installations.length }} {{ installations.length === 1 ? 'server' : 'servers' }} installed
            </div>
          </div>
        </div>
      </TeamManageTabs>
    </div>
  </NavbarLayout>
</template>
