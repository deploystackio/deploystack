<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Trash2,
  AlertTriangle,
  ChevronRight,
  Github,
} from 'lucide-vue-next'
import type { McpInstallation } from '@/types/mcp-installations'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService } from '@/services/teamService'
import CategoryDisplay from '@/components/mcp-server/CategoryDisplay.vue'
import { useEventBus } from '@/composables/useEventBus'

interface Props {
  installations: McpInstallation[]
  showWalkthrough?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  viewInstallation: [serverId: string]
  manageInstallation: [installationId: string]
  removeInstallation: [installationId: string]
}>()

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()

// Modal state
const showDeleteModal = ref(false)
const isDeleting = ref(false)
const deleteError = ref<string | null>(null)
const installationToDelete = ref<McpInstallation | null>(null)

// Walkthrough state
const showWalkthroughOverlay = ref(false)
const showWalkthroughBorder = ref(false)
const showWalkthroughHighZIndex = ref(false)

// Watch for walkthrough prop changes
// Note: Walkthrough popover is now handled by parent index.vue

// Find which team owns the installation
async function findInstallationTeam(installationId: string): Promise<{ teamId: string; installation: McpInstallation } | null> {
  try {
    // First check if the installation has a team_id (for direct lookup)
    const installation = props.installations.find(inst => inst.id === installationId)
    if (installation && installation.team_id) {
      return { teamId: installation.team_id, installation }
    }

    // Fallback to searching through user's teams
    const userTeams = await TeamService.getUserTeams()

    for (const team of userTeams) {
      try {
        const installations = await McpInstallationService.getTeamInstallations(team.id)
        const foundInstallation = installations.find(inst => inst.id === installationId)

        if (foundInstallation) {
          return { teamId: team.id, installation: foundInstallation }
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

// Computed
const sortedInstallations = computed(() => {
  return [...props.installations].sort((a, b) =>
    a.installation_name.localeCompare(b.installation_name)
  )
})

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const handleViewInstallation = (installationId: string) => {
  router.push(`/mcp-server/installation/${installationId}`)
}

const confirmRemoval = async () => {
  if (!installationToDelete.value) return

  try {
    isDeleting.value = true
    deleteError.value = null

    // Find which team owns this installation
    const result = await findInstallationTeam(installationToDelete.value.id)

    if (!result) {
      deleteError.value = t('mcpInstallations.removal.notifications.notFoundError')
      return
    }

    // Call the API to remove the installation
    await McpInstallationService.removeInstallation(result.teamId, installationToDelete.value.id)

    // Emit success event
    emit('removeInstallation', installationToDelete.value.id)

    // Close modal
    showDeleteModal.value = false
    installationToDelete.value = null

  } catch (err) {
    // Handle specific error types
    if (err instanceof Error) {
      if (err.message.includes('403') || err.message.includes('permission')) {
        deleteError.value = t('mcpInstallations.removal.notifications.permissionError')
      } else if (err.message.includes('404') || err.message.includes('not found')) {
        deleteError.value = t('mcpInstallations.removal.notifications.notFoundError')
      } else {
        deleteError.value = t('mcpInstallations.removal.notifications.genericError', { error: err.message })
      }
    } else {
      deleteError.value = t('mcpInstallations.removal.notifications.genericError', { error: 'Unknown error' })
    }
  } finally {
    isDeleting.value = false
  }
}

const cancelRemoval = () => {
  deleteError.value = null
  showDeleteModal.value = false
  installationToDelete.value = null
}

// Event handlers for walkthrough overlay
const handleWalkthroughOverlayShow = () => {
  showWalkthroughOverlay.value = true
  showWalkthroughBorder.value = true
  showWalkthroughHighZIndex.value = true
}

const handleWalkthroughOverlayHide = () => {
  showWalkthroughOverlay.value = false
  showWalkthroughBorder.value = false
  showWalkthroughHighZIndex.value = false
}

// Event handlers for step-specific z-index control
const handleWalkthroughStep1Active = () => {
  // Step 1: MCP liste should be visible (high z-index)
  showWalkthroughHighZIndex.value = true
  showWalkthroughBorder.value = true
}

const handleWalkthroughStep2Active = () => {
  // Step 2: MCP liste should be hidden under overlay (no high z-index)
  showWalkthroughHighZIndex.value = false
  showWalkthroughBorder.value = false
}

onMounted(() => {
  // Listen for walkthrough overlay events
  eventBus.on('walkthrough-overlay-show', handleWalkthroughOverlayShow)
  eventBus.on('walkthrough-overlay-hide', handleWalkthroughOverlayHide)

  // Listen for step-specific events
  eventBus.on('walkthrough-step1-active', handleWalkthroughStep1Active)
  eventBus.on('walkthrough-step2-active', handleWalkthroughStep2Active)
})

onUnmounted(() => {
  // Clean up event listeners
  eventBus.off('walkthrough-overlay-show', handleWalkthroughOverlayShow)
  eventBus.off('walkthrough-overlay-hide', handleWalkthroughOverlayHide)
  eventBus.off('walkthrough-step1-active', handleWalkthroughStep1Active)
  eventBus.off('walkthrough-step2-active', handleWalkthroughStep2Active)
})
</script>

<template>
  <!-- Walkthrough Background Overlay -->
  <div
    v-if="showWalkthroughOverlay && sortedInstallations.length > 0"
    class="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]"
  />

  <div class="min-h-screen bg-gray-50">
    <div class="mx-auto max-w-4xl space-y-8 py-16">
      <!-- Installations List -->
      <div v-if="sortedInstallations.length > 0" class="relative">
        <ul
          role="list"
          :class="[
            'divide-y divide-gray-100 overflow-hidden bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg relative',
            showWalkthroughHighZIndex ? 'z-[9999]' : '',
            showWalkthroughBorder ? 'ring-4 ring-teal-500 ring-opacity-50' : ''
          ]"
        >
        <li
          v-for="(installation, index) in sortedInstallations"
          :key="installation.id"
          :id="index === sortedInstallations.length - 1 ? 'last-server-item' : undefined"
          class="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6"
        >
          <div class="flex min-w-0 gap-x-4">
            <div class="min-w-0 flex-auto">
              <p class="text-sm/6 font-semibold text-gray-900 mb-2">
                <a @click="handleViewInstallation(installation.id)" class="cursor-pointer hover:text-blue-600 transition-colors">
                  {{ installation.installation_name }}
                </a>
              </p>

              <dl class="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-xs/5 text-gray-500 sm:grid-cols-5">
                <div>
                  <dt class="font-medium text-gray-700">{{ t('mcpInstallations.table.columns.installationMethod') }}</dt>
                  <dd>{{ installation.installation_type }}</dd>
                </div>
                <div>
                  <dt class="font-medium text-gray-700">{{ t('mcpInstallations.table.columns.category') }}</dt>
                  <dd>
                    <CategoryDisplay
                      :category-id="installation.server.category_id"
                      :show-not-provided="true"
                      text-class="text-xs"
                      icon-class="h-3 w-3 text-gray-600"
                    />
                  </dd>
                </div>
                <div>
                  <dt class="font-medium text-gray-700">{{ t('mcpInstallations.table.columns.runtime') }}</dt>
                  <dd>{{ installation.server.runtime }}</dd>
                </div>
                <div>
                  <dt class="font-medium text-gray-700">{{ t('mcpInstallations.table.columns.installed') }}</dt>
                  <dd>{{ formatDate(installation.created_at) }}</dd>
                </div>
                <div>
                  <dt class="font-medium text-gray-700">{{ t('mcpInstallations.table.columns.repository') }}</dt>
                  <dd v-if="installation.server.github_url">
                    <a
                      :href="installation.server.github_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <Github class="h-3 w-3" />
                      {{ t('mcpInstallations.table.values.github') }}
                    </a>
                  </dd>
                  <dd v-else class="text-gray-400">
                    {{ t('mcpInstallations.table.values.noRepository') }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div
            class="flex shrink-0 items-center gap-x-4 cursor-pointer hover:text-blue-600 transition-colors"
            @click="handleViewInstallation(installation.id)"
          >
            <div class="hidden sm:flex sm:flex-col sm:items-end">
              <p v-if="installation.last_used_at" class="mt-1 text-xs/5 text-gray-500">
                {{ t('mcpInstallations.table.values.lastUsed') }} <time :datetime="installation.last_used_at">{{ formatDate(installation.last_used_at) }}</time>
              </p>
              <div v-else class="mt-1 flex items-center gap-x-1.5">
                <div class="flex-none rounded-full bg-emerald-500/20 p-1">
                  <div class="size-1.5 rounded-full bg-emerald-500" />
                </div>
                <p class="text-xs/5 text-gray-500">{{ t('mcpInstallations.table.values.available') }}</p>
              </div>
            </div>

            <ChevronRight class="size-5 flex-none text-gray-400" aria-hidden="true" />
            </div>
            </li>
            </ul>

            <!-- Walkthrough Popover positioned relative to last server -->
            <!-- REMOVED: Duplicate popover - handled by parent index.vue -->
    </div>

      <!-- Empty State -->
      <div
        v-else
        class="text-center py-12 bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg"
      >
        <p class="text-sm text-gray-500">{{ t('mcpInstallations.table.noData') }}</p>
      </div>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <AlertDialog v-model:open="showDeleteModal">
    <AlertDialogContent class="sm:max-w-[425px]">
      <AlertDialogHeader>
        <AlertDialogTitle class="flex items-center gap-2 text-red-600">
          <AlertTriangle class="h-5 w-5" />
          {{ t('mcpInstallations.removal.modal.title') }}
        </AlertDialogTitle>
        <AlertDialogDescription class="text-left">
          {{ t('mcpInstallations.removal.modal.description', {
            name: installationToDelete?.installation_name || ''
          }) }}
          <br><br>
          <span class="text-red-600 font-medium">
            {{ t('mcpInstallations.removal.modal.warning') }}
          </span>
        </AlertDialogDescription>
      </AlertDialogHeader>

      <!-- Delete Error Display -->
      <Alert v-if="deleteError" variant="destructive" class="mx-6">
        <AlertTriangle class="h-4 w-4" />
        <AlertDescription>
          {{ deleteError }}
        </AlertDescription>
      </Alert>

      <AlertDialogFooter class="flex gap-2">
        <AlertDialogCancel
          @click="cancelRemoval"
          :disabled="isDeleting"
        >
          {{ t('mcpInstallations.removal.modal.cancelButton') }}
        </AlertDialogCancel>
        <AlertDialogAction
          @click="confirmRemoval"
          :disabled="isDeleting"
          class="bg-red-600 hover:bg-red-700"
        >
          <Trash2 v-if="!isDeleting" class="h-4 w-4 mr-2" />
          <div v-else class="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          {{ isDeleting ? t('mcpInstallations.removal.modal.removing') : t('mcpInstallations.removal.modal.confirmButton') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
