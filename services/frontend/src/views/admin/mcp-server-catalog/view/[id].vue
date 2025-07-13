<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Github, ExternalLink, Star, Package, Code, Settings, Calendar, Tag, Trash2, AlertTriangle, Edit } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import type { McpServer } from '../types'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const server = ref<McpServer | null>(null)
const isLoading = ref(true)
const isDeleting = ref(false)
const error = ref<string | null>(null)
const showDeleteDialog = ref(false)

const serverId = route.params.id as string

// Fetch server details from API
async function fetchServer(id: string): Promise<McpServer> {
  return await McpCatalogService.getServerById(id)
}

// Load server on component mount
onMounted(async () => {
  try {
    isLoading.value = true
    server.value = await fetchServer(serverId)
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    server.value = null
  } finally {
    isLoading.value = false
  }
})

// Computed properties for display
const displayTags = computed(() => {
  if (!server.value?.tags || server.value.tags.length === 0) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.tags)) {
    return server.value.tags
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(server.value.tags as any)
  } catch {
    return []
  }
})

const displayTools = computed(() => {
  if (!server.value?.tools) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.tools)) {
    return server.value.tools
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(server.value.tools as any)
  } catch {
    return []
  }
})

const displayResources = computed(() => {
  if (!server.value?.resources) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.resources)) {
    return server.value.resources
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(server.value.resources as any)
  } catch {
    return []
  }
})

const displayPrompts = computed(() => {
  if (!server.value?.prompts) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.prompts)) {
    return server.value.prompts
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(server.value.prompts as any)
  } catch {
    return []
  }
})

const displayInstallationMethods = computed(() => {
  if (!server.value?.installation_methods) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.installation_methods)) {
    return server.value.installation_methods
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(server.value.installation_methods as any)
  } catch {
    return []
  }
})

// Get status badge variant
const getStatusVariant = (status: string) => {
  switch (status) {
    case 'active':
      return 'default'
    case 'deprecated':
      return 'destructive'
    case 'maintenance':
      return 'secondary'
    default:
      return 'outline'
  }
}

// Get language badge color
const getLanguageBadgeClass = (language: string) => {
  const colors: Record<string, string> = {
    typescript: 'bg-blue-100 text-blue-800',
    javascript: 'bg-yellow-100 text-yellow-800',
    python: 'bg-green-100 text-green-800',
    go: 'bg-cyan-100 text-cyan-800',
    rust: 'bg-orange-100 text-orange-800',
    java: 'bg-red-100 text-red-800',
    csharp: 'bg-purple-100 text-purple-800',
  }
  return colors[language.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

// Format date for display
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

// Delete server
const deleteServer = async () => {
  try {
    isDeleting.value = true
    const serverName = server.value?.name || 'Unknown Server'
    await McpCatalogService.deleteGlobalServer(serverId)

    // Redirect to catalog with success message
    router.push({
      path: '/admin/mcp-server-catalog',
      query: { deleted: serverName }
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete server'
    console.error('Error deleting server:', err)
  } finally {
    isDeleting.value = false
    showDeleteDialog.value = false
  }
}

// Placeholder function for edit functionality (not implemented yet)
const handleEditServer = () => {
  // TODO: Implement edit functionality
  console.log('Edit server functionality not implemented yet')
}

const goBack = () => {
  router.push('/admin/mcp-server-catalog')
}
</script>

<template>
  <DashboardLayout :title="server ? t('mcpCatalog.edit.title', { name: server.name }) : t('mcpCatalog.edit.titleLoading')">
    <div class="space-y-6">
      <!-- Header with Back and Manage Dropdown -->
      <div class="flex items-center justify-between">
        <Button
          variant="outline"
          @click="goBack"
        >
          <ArrowLeft class="h-4 w-4 mr-2" />
          {{ t('mcpCatalog.edit.backToCatalog') }}
        </Button>

        <!-- Manage Server Dropdown -->
        <DropdownMenu v-if="server">
          <DropdownMenuTrigger asChild>
            <Button variant="outline" :disabled="isDeleting">
              <Settings class="h-4 w-4 mr-2" />
              {{ t('mcpCatalog.edit.actions.manageServer') }}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="handleEditServer">
              <Edit class="h-4 w-4 mr-2" />
              {{ t('mcpCatalog.edit.actions.editServer') }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="showDeleteDialog = true" class="text-red-600 focus:text-red-600">
              <Trash2 class="h-4 w-4 mr-2" />
              {{ t('mcpCatalog.edit.actions.deleteServer') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('mcpCatalog.edit.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('mcpCatalog.edit.errorLoading', { error }) }}
      </div>

      <!-- Server Details -->
      <div v-else-if="server">
        <div class="px-4 sm:px-0">
          <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpCatalog.edit.serverInformation') }}</h3>
          <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('mcpCatalog.edit.serverDetails') }}</p>
        </div>
        <div class="mt-6 border-t border-gray-100">
          <dl class="divide-y divide-gray-100">
            <!-- Server Name -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.name') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="flex items-center gap-2">
                  {{ server.name }}
                  <Badge v-if="server.featured" variant="default" class="flex items-center gap-1">
                    <Star class="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {{ t('mcpCatalog.edit.values.featured') }}
                  </Badge>
                </div>
              </dd>
            </div>

            <!-- Description -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.description') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                {{ server.description || t('mcpCatalog.edit.values.notProvided') }}
              </dd>
            </div>

            <!-- Long Description -->
            <div v-if="server.long_description" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.longDescription') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="whitespace-pre-wrap">{{ server.long_description }}</div>
              </dd>
            </div>

            <!-- Author Information -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.author') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div><span class="font-medium">{{ t('mcpCatalog.edit.values.authorName') }}</span> {{ server.author_name || t('mcpCatalog.edit.values.notProvided') }}</div>
                  <div><span class="font-medium">{{ t('mcpCatalog.edit.values.authorContact') }}</span> {{ server.author_contact || t('mcpCatalog.edit.values.notProvided') }}</div>
                  <div><span class="font-medium">{{ t('mcpCatalog.edit.values.organization') }}</span> {{ server.organization || t('mcpCatalog.edit.values.notProvided') }}</div>
                </div>
              </dd>
            </div>

            <!-- Technical Specifications -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.technical') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{{ t('mcpCatalog.edit.values.language') }}</span>
                    <Badge
                      variant="outline"
                      :class="getLanguageBadgeClass(server.language)"
                    >
                      {{ server.language }}
                    </Badge>
                  </div>
                  <div><span class="font-medium">{{ t('mcpCatalog.edit.values.runtime') }}</span> {{ server.runtime }}</div>
                  <div v-if="server.runtime_min_version">
                    <span class="font-medium">{{ t('mcpCatalog.edit.values.minVersion') }}</span> {{ server.runtime_min_version }}
                  </div>
                  <div><span class="font-medium">{{ t('mcpCatalog.edit.values.license') }}</span> {{ server.license || t('mcpCatalog.edit.values.notProvided') }}</div>
                </div>
              </dd>
            </div>

            <!-- Repository Links -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.links') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div v-if="server.github_url" class="flex items-center gap-1">
                    <Github class="h-4 w-4 text-muted-foreground" />
                    <a
                      :href="server.github_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-blue-600 hover:underline"
                    >
                      {{ t('mcpCatalog.edit.values.repository') }}
                      <ExternalLink class="inline h-3 w-3 ml-1" />
                    </a>
                  </div>
                  <div v-if="server.homepage_url" class="flex items-center gap-1">
                    <ExternalLink class="h-4 w-4 text-muted-foreground" />
                    <a
                      :href="server.homepage_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-blue-600 hover:underline"
                    >
                      {{ t('mcpCatalog.edit.values.homepage') }}
                      <ExternalLink class="inline h-3 w-3 ml-1" />
                    </a>
                  </div>
                  <div v-if="!server.github_url && !server.homepage_url" class="text-muted-foreground">
                    {{ t('mcpCatalog.edit.values.noLinks') }}
                  </div>
                </div>
              </dd>
            </div>

            <!-- Status and Classification -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.status') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{{ t('mcpCatalog.edit.values.status') }}</span>
                    <Badge :variant="getStatusVariant(server.status)">
                      {{ t(`mcpCatalog.status.${server.status}`) }}
                    </Badge>
                  </div>
                  <div><span class="font-medium">{{ t('mcpCatalog.edit.values.visibility') }}</span> {{ server.visibility }}</div>
                </div>
              </dd>
            </div>

            <!-- Tags -->
            <div v-if="displayTags.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.tags') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <div class="flex flex-wrap gap-2">
                  <Badge
                    v-for="tag in displayTags"
                    :key="tag"
                    variant="outline"
                    class="flex items-center gap-1"
                  >
                    <Tag class="h-3 w-3" />
                    {{ tag }}
                  </Badge>
                </div>
              </dd>
            </div>

            <!-- Installation Methods -->
            <div v-if="displayInstallationMethods.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.installation') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(method, index) in displayInstallationMethods"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <Package class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <span class="truncate font-medium">{{ method.type || 'Installation Method' }}</span>
                        <span v-if="method.command" class="truncate text-gray-500 font-mono text-xs">{{ method.command }}</span>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

            <!-- Tools -->
            <div v-if="displayTools.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.tools') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(tool, index) in displayTools"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <Settings class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <span class="truncate font-medium">{{ tool.name || 'Tool' }}</span>
                          <span v-if="tool.description" class="truncate text-xs text-gray-500">{{ tool.description }}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

            <!-- Resources -->
            <div v-if="displayResources.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.resources') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(resource, index) in displayResources"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <Code class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <span class="truncate font-medium">{{ resource.name || 'Resource' }}</span>
                          <span v-if="resource.description" class="truncate text-xs text-gray-500">{{ resource.description }}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

            <!-- Prompts -->
            <div v-if="displayPrompts.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.prompts') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(prompt, index) in displayPrompts"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <Code class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <span class="truncate font-medium">{{ prompt.name || 'Prompt' }}</span>
                          <span v-if="prompt.description" class="truncate text-xs text-gray-500">{{ prompt.description }}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

            <!-- System Information -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.systemInfo') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div class="flex items-center gap-1">
                    <Calendar class="h-4 w-4 text-muted-foreground" />
                    <span class="font-medium">{{ t('mcpCatalog.edit.values.created') }}</span> {{ formatDate(server.created_at) }}
                  </div>
                  <div class="flex items-center gap-1">
                    <Calendar class="h-4 w-4 text-muted-foreground" />
                    <span class="font-medium">{{ t('mcpCatalog.edit.values.updated') }}</span> {{ formatDate(server.updated_at) }}
                  </div>
                  <div v-if="server.last_sync_at" class="flex items-center gap-1">
                    <Calendar class="h-4 w-4 text-muted-foreground" />
                    <span class="font-medium">{{ t('mcpCatalog.edit.values.lastSync') }}</span> {{ formatDate(server.last_sync_at) }}
                  </div>
                  <div><span class="font-medium">{{ t('mcpCatalog.edit.values.serverId') }}</span> <span class="font-mono text-xs">{{ server.id }}</span></div>
                  <div><span class="font-medium">{{ t('mcpCatalog.edit.values.slug') }}</span> <span class="font-mono text-xs">{{ server.slug }}</span></div>
                </div>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Delete Confirmation Dialog -->
      <AlertDialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle class="flex items-center gap-2 text-red-600">
              <AlertTriangle class="h-5 w-5" />
              {{ t('mcpCatalog.edit.deleteDialog.title') }}
            </AlertDialogTitle>
            <AlertDialogDescription class="space-y-2">
              <p>{{ t('mcpCatalog.edit.deleteDialog.warning') }}</p>
              <p class="font-medium">{{ t('mcpCatalog.edit.deleteDialog.serverName') }}: "{{ server?.name }}"</p>
              <div class="bg-red-50 p-3 rounded-md">
                <p class="text-sm text-red-800">{{ t('mcpCatalog.edit.deleteDialog.consequences') }}</p>
                <ul class="text-xs text-red-700 mt-2 space-y-1">
                  <li>• {{ t('mcpCatalog.edit.deleteDialog.consequencesList.server') }}</li>
                  <li>• {{ t('mcpCatalog.edit.deleteDialog.consequencesList.configurations') }}</li>
                  <li>• {{ t('mcpCatalog.edit.deleteDialog.consequencesList.history') }}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel @click="showDeleteDialog = false">
              {{ t('mcpCatalog.edit.deleteDialog.cancel') }}
            </AlertDialogCancel>
            <AlertDialogAction
              @click="deleteServer"
              :disabled="isDeleting"
              class="bg-red-600 hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 class="h-4 w-4" />
              {{ isDeleting ? t('mcpCatalog.edit.deleteDialog.deleting') : t('mcpCatalog.edit.deleteDialog.confirm') }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </DashboardLayout>
</template>
