<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { AlertCircle, Server } from 'lucide-vue-next'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { TeamManageHeader, TeamManageTabs } from '@/components/teams/manage'
import { useTeamCache } from '@/composables/teams/useTeamCache'
import { useEventBus } from '@/composables/useEventBus'
import { TeamService, type TeamMcpInstallation } from '@/services/teamService'

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

// Get status badge variant
function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'online':
      return 'default'
    case 'offline':
      return 'secondary'
    case 'error':
      return 'destructive'
    case 'provisioning':
      return 'outline'
    default:
      return 'outline'
  }
}

// Get status badge class
function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'online':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'offline':
      return 'bg-neutral-50 text-neutral-700 border-neutral-200'
    case 'error':
      return ''
    case 'provisioning':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    default:
      return ''
  }
}

// Format date
function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString()
}

// Navigate to installation details
function navigateToInstallation(installationId: string) {
  router.push(`/mcp-server/view/${installationId}`)
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
              <Server />
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
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Runtime</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="installation in installations"
                  :key="installation.id"
                  class="cursor-pointer hover:bg-muted/50"
                  @click="navigateToInstallation(installation.id)"
                >
                  <!-- Name with Icon -->
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <img
                        v-if="installation.server.icon_url"
                        :src="installation.server.icon_url"
                        :alt="installation.installation_name"
                        class="h-6 w-6 rounded"
                      />
                      <Server v-else class="h-6 w-6 text-muted-foreground" />
                      <span class="font-medium">{{ installation.installation_name }}</span>
                    </div>
                  </TableCell>

                  <!-- Type -->
                  <TableCell>
                    <Badge variant="outline" class="text-xs">
                      {{ installation.installation_type }}
                    </Badge>
                  </TableCell>

                  <!-- Status -->
                  <TableCell>
                    <Badge
                      :variant="getStatusBadgeVariant(installation.status)"
                      :class="getStatusBadgeClass(installation.status)"
                    >
                      {{ installation.status }}
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
