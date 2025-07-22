<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Info, Settings, Shield } from 'lucide-vue-next'
import { DsTabs, DsTabsItem } from '@/components/ui/ds-tabs'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { InstallationInfo, EnvironmentVariables, DangerZone } from '@/components/mcp-server/installation'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService } from '@/services/teamService'
import type { McpInstallation } from '@/types/mcp-installations'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const installation = ref<McpInstallation | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const activeTab = ref('information')

const installationId = route.params.id as string

// Find which team owns the installation (similar to McpInstallationsList)
async function findInstallationTeam(installationId: string): Promise<{ teamId: string; installation: McpInstallation } | null> {
  try {
    // Get user's teams
    const userTeams = await TeamService.getUserTeams()

    for (const team of userTeams) {
      try {
        const installation = await McpInstallationService.getInstallationById(team.id, installationId)
        if (installation) {
          return { teamId: team.id, installation }
        }
      } catch {
        // Continue to next team if not found
        continue
      }
    }

    return null
  } catch {
    return null
  }
}

// Load installation on component mount
onMounted(async () => {
  try {
    isLoading.value = true
    const result = await findInstallationTeam(installationId)

    if (result) {
      installation.value = result.installation
      error.value = null
    } else {
      error.value = 'Installation not found or you do not have access to it'
      installation.value = null
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    installation.value = null
  } finally {
    isLoading.value = false
  }
})

// Computed properties for display
const pageTitle = computed(() => {
  return installation.value
    ? `Installation: ${installation.value.installation_name}`
    : 'Loading Installation...'
})

// Check if environment variables exist for badge display
const environmentVariablesCount = computed(() => {
  if (!installation.value?.user_environment_variables) return 0
  return Object.keys(installation.value.user_environment_variables).length
})

const goBack = () => {
  router.push('/mcp-server')
}
</script>

<template>
  <DashboardLayout :title="pageTitle">
    <div class="space-y-6">
      <!-- Header with Back Button -->
      <div class="flex items-center justify-between">
        <Button
          variant="outline"
          @click="goBack"
        >
          <ArrowLeft class="h-4 w-4 mr-2" />
          {{ t('mcpInstallations.view.backToServers') }}
        </Button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('mcpInstallations.view.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('mcpInstallations.view.errorLoading', { error }) }}
      </div>

      <!-- Installation Details with Tabs -->
      <div v-else-if="installation">
        <DsTabs v-model="activeTab" class="mb-6">
          <DsTabsItem value="information" label="Installation Info">
            <Info class="h-4 w-4" />
          </DsTabsItem>
          <DsTabsItem
            value="environment"
            label="Environment Variables"
            :badge="environmentVariablesCount > 0 ? environmentVariablesCount : undefined"
          >
            <Settings class="h-4 w-4" />
          </DsTabsItem>
          <DsTabsItem value="danger-zone" label="Danger Zone">
            <Shield class="h-4 w-4" />
          </DsTabsItem>
        </DsTabs>

        <!-- Tab Content -->
        <div>
          <!-- Content Wrapper with same styling as EnvironmentVariablesStep -->
          <div class="bg-muted/50 rounded-lg sm:rounded-lg">
            <div class="py-16 sm:py-24">
              <div class="mx-auto max-w-7xl sm:px-2 lg:px-8">
                <div class="mx-auto max-w-2xl px-4 lg:max-w-4xl lg:px-0">
                  <!-- White Card inside the gray wrapper -->
                  <Card class="bg-white shadow-sm">
                    <CardContent class="p-6">
                      <InstallationInfo
                        v-if="activeTab === 'information'"
                        :installation="installation"
                      />
                      <EnvironmentVariables
                        v-if="activeTab === 'environment'"
                        :installation="installation"
                      />
                      <DangerZone
                        v-if="activeTab === 'danger-zone'"
                        :installation="installation"
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
