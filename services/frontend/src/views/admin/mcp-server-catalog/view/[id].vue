<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import CategoryDisplay from '@/components/mcp-server/CategoryDisplay.vue'
import ContentWrapper from '@/components/ContentWrapper.vue'
import { ArrowLeft, Github, GitBranch, Globe, ExternalLink, Package, Settings, Calendar, Tag, Trash2, AlertTriangle, Edit, Terminal, Users, User, Lock, Unlock, Link } from 'lucide-vue-next'
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

    // Check for success query parameter
    if (route.query.updated === 'true') {
      toast.success(t('mcpCatalog.messages.updateSuccess'))
      // Remove the query parameter from URL without triggering navigation
      router.replace({ query: {} })
    }
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

const displayPackages = computed(() => {
  if (!server.value?.packages) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.packages)) {
    return server.value.packages.filter(pkg => pkg != null)
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(server.value.packages as any)
    return Array.isArray(parsed) ? parsed.filter(pkg => pkg != null) : []
  } catch {
    return []
  }
})

const displayRemotes = computed(() => {
  if (!server.value?.remotes) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.remotes)) {
    return server.value.remotes.filter(remote => remote != null)
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(server.value.remotes as any)
    return Array.isArray(parsed) ? parsed.filter(remote => remote != null) : []
  } catch {
    return []
  }
})



const displayTemplateArgs = computed(() => {
  if (!server.value?.template_args) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.template_args)) {
    return server.value.template_args.filter(arg => arg != null)
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(server.value.template_args as any)
    return Array.isArray(parsed) ? parsed.filter(arg => arg != null) : []
  } catch {
    return []
  }
})

const displayTeamEnvSchema = computed(() => {
  if (!server.value?.team_env_schema) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.team_env_schema)) {
    return server.value.team_env_schema.filter(env => env != null)
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(server.value.team_env_schema as any)
    return Array.isArray(parsed) ? parsed.filter(env => env != null) : []
  } catch {
    return []
  }
})

const displayUserEnvSchema = computed(() => {
  if (!server.value?.user_env_schema) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.user_env_schema)) {
    return server.value.user_env_schema.filter(env => env != null)
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(server.value.user_env_schema as any)
    return Array.isArray(parsed) ? parsed.filter(env => env != null) : []
  } catch {
    return []
  }
})

const displayTeamHeadersSchema = computed(() => {
  if (!server.value?.team_headers_schema) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.team_headers_schema)) {
    return server.value.team_headers_schema.filter(header => header != null)
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(server.value.team_headers_schema as any)
    return Array.isArray(parsed) ? parsed.filter(header => header != null) : []
  } catch {
    return []
  }
})

const displayUserHeadersSchema = computed(() => {
  if (!server.value?.user_headers_schema) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.user_headers_schema)) {
    return server.value.user_headers_schema.filter(header => header != null)
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(server.value.user_headers_schema as any)
    return Array.isArray(parsed) ? parsed.filter(header => header != null) : []
  } catch {
    return []
  }
})

const displayTemplateHeaders = computed(() => {
  if (!server.value?.template_headers) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.template_headers)) {
    return server.value.template_headers.filter(header => header != null)
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(server.value.template_headers as any)
    return Array.isArray(parsed) ? parsed.filter(header => header != null) : []
  } catch {
    return []
  }
})

const displayTransportType = computed(() => {
  return server.value?.transport_type || t('mcpCatalog.edit.values.transportType.notSpecified')
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

// Navigate to edit page
const handleEditServer = () => {
  router.push(`/admin/mcp-server-catalog/edit/${serverId}`)
}

const getGitHubAvatarUrl = (server: McpServer) => {
  // Only show GitHub avatar if the repository is hosted on GitHub
  if (!server.github_account_id || (server.repository_source && server.repository_source !== 'github')) {
    return null
  }
  return `https://avatars.githubusercontent.com/u/${server.github_account_id}?v=4&s=128`
}

// Get repository icon based on platform
const getRepositoryIcon = (platform: string | undefined) => {
  switch (platform) {
    case 'github':
      return Github
    case 'gitlab':
    case 'bitbucket':
      return GitBranch
    default:
      return Globe
  }
}

// Get repository label based on platform
const getRepositoryLabel = (platform: string | undefined) => {
  switch (platform) {
    case 'github':
      return t('mcpCatalog.edit.values.repository')
    case 'gitlab':
      return 'GitLab Repository'
    case 'bitbucket':
      return 'Bitbucket Repository'
    default:
      return t('mcpCatalog.edit.values.repository')
  }
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
      <ContentWrapper v-if="server">
        <!-- Basic Information Section -->
        <div class="px-4 sm:px-0 flex items-center gap-4">
          <img
            v-if="getGitHubAvatarUrl(server)"
            :src="getGitHubAvatarUrl(server)!"
            :alt="`${server.name} GitHub avatar`"
            class="h-12 w-12 rounded-lg flex-shrink-0"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <div>
            <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpCatalog.edit.serverInformation') }}</h3>
            <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('mcpCatalog.edit.serverDetails') }}</p>
          </div>
        </div>
        <div class="mt-6 border-t border-gray-100">
          <dl class="divide-y divide-gray-100">
            <!-- Server Name -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.name') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                {{ server.name }}
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

            <!-- Category -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.category') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <CategoryDisplay :category-id="server.category_id" />
              </dd>
            </div>

            <!-- Featured -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.featured.label') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <Badge v-if="server.featured" variant="default">
                  {{ t('mcpCatalog.edit.values.yes') }}
                </Badge>
                <span v-else class="text-muted-foreground">
                  {{ t('mcpCatalog.edit.values.no') }}
                </span>
              </dd>
            </div>

            <!-- Auto Install for New Default Teams -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.form.basic.autoInstall.label') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <Badge v-if="server.auto_install_new_default_team" variant="default">
                  {{ t('mcpCatalog.edit.values.yes') }}
                </Badge>
                <span v-else class="text-muted-foreground">
                  {{ t('mcpCatalog.edit.values.no') }}
                </span>
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
                  <div><span class="font-medium">{{ t('mcpCatalog.edit.values.license') }}</span> {{ server.license || t('mcpCatalog.edit.values.notProvided') }}</div>
                </div>
              </dd>
            </div>

            <!-- Repository Links -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.links') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <!-- Primary Repository URL -->
                  <div v-if="server.repository_url" class="flex items-center gap-1">
                    <component
                      :is="getRepositoryIcon(server.repository_source)"
                      class="h-4 w-4 text-muted-foreground"
                    />
                    <a
                      :href="server.repository_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-blue-600 hover:underline"
                    >
                      {{ getRepositoryLabel(server.repository_source) }}
                      <ExternalLink class="inline h-3 w-3 ml-1" />
                    </a>
                    <!-- Show platform badge if available -->
                    <Badge v-if="server.repository_source" variant="outline" class="text-xs">
                      {{ McpCatalogService.getPlatformDisplayName(server.repository_source) }}
                    </Badge>
                  </div>
                  <div v-if="server.website_url" class="flex items-center gap-1">
                    <ExternalLink class="h-4 w-4 text-muted-foreground" />
                    <a
                      :href="server.website_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-blue-600 hover:underline"
                    >
                      {{ t('mcpCatalog.edit.values.homepage') }}
                      <ExternalLink class="inline h-3 w-3 ml-1" />
                    </a>
                  </div>
                  <div v-if="!server.repository_url && !server.website_url" class="text-muted-foreground">
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

          </dl>
        </div>



        <!-- Server Configuration Section -->
        <div class="px-4 sm:px-0 mt-8">
          <h3 class="text-base/7 font-semibold text-gray-900">Server Configuration</h3>
          <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">Official MCP Registry server configuration and transport details</p>
        </div>
        <div class="mt-6 border-t border-gray-100">
          <dl class="divide-y divide-gray-100">
            <!-- Transport Type -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.transportType') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    :class="{
                      'bg-blue-50 text-blue-700 border-blue-200': displayTransportType === 'stdio',
                      'bg-green-50 text-green-700 border-green-200': displayTransportType === 'http',
                      'bg-yellow-50 text-yellow-700 border-yellow-200': displayTransportType === 'sse',
                      'bg-gray-50 text-gray-600 border-gray-200': displayTransportType === t('mcpCatalog.edit.values.transportType.notSpecified')
                    }"
                  >
                    {{ displayTransportType === 'stdio' ? t('mcpCatalog.edit.values.transportType.stdio') :
                       displayTransportType === 'http' ? t('mcpCatalog.edit.values.transportType.http') :
                       displayTransportType === 'sse' ? t('mcpCatalog.edit.values.transportType.sse') :
                       t('mcpCatalog.edit.values.transportType.notSpecified') }}
                  </Badge>
                  <span v-if="displayTransportType === 'stdio'" class="text-xs text-muted-foreground">
                    {{ t('mcpCatalog.edit.values.transportType.stdioDescription') }}
                  </span>
                  <span v-else-if="displayTransportType === 'http'" class="text-xs text-muted-foreground">
                    {{ t('mcpCatalog.edit.values.transportType.httpDescription') }}
                  </span>
                  <span v-else-if="displayTransportType === 'sse'" class="text-xs text-muted-foreground">
                    {{ t('mcpCatalog.edit.values.transportType.sseDescription') }}
                  </span>
                </div>
              </dd>
            </div>

            <!-- Packages (STDIO Transport) -->
            <div v-if="displayPackages.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">Packages (STDIO)</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(pkg, index) in displayPackages"
                    :key="index"
                    class="py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex items-start gap-3">
                      <Package class="size-5 shrink-0 text-gray-400 mt-0.5" aria-hidden="true" />
                      <div class="flex-1 space-y-3">
                        <!-- Package Info -->
                        <div class="flex items-center gap-2">
                          <Badge variant="outline" class="bg-blue-50 text-blue-700 border-blue-200">
                            {{ pkg.registryType || 'npm' }}
                          </Badge>
                          <code class="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{{ pkg.identifier }}</code>
                          <span v-if="pkg.version" class="text-xs text-gray-500">v{{ pkg.version }}</span>
                        </div>

                        <!-- Transport Command -->
                        <div v-if="pkg.transport" class="space-y-1">
                          <div class="text-xs font-medium text-gray-600">Transport:</div>
                          <div class="bg-gray-50 rounded-md p-2">
                            <code class="text-xs font-mono text-gray-800">{{ pkg.transport.command || 'npx' }} {{ pkg.transport.args ? pkg.transport.args.join(' ') : '' }}</code>
                          </div>
                        </div>

                        <!-- Environment Variables -->
                        <div v-if="pkg.environmentVariables && pkg.environmentVariables.length > 0" class="space-y-1">
                          <div class="text-xs font-medium text-gray-600">Environment Variables:</div>
                          <div class="space-y-1">
                            <div
                              v-for="(envVar, envIndex) in pkg.environmentVariables"
                              :key="envIndex"
                              class="flex items-center gap-2 text-xs"
                            >
                              <code class="bg-green-50 text-green-700 px-2 py-1 rounded font-mono">{{ envVar.name }}</code>
                              <Badge v-if="envVar.isRequired" variant="default" class="text-xs">Required</Badge>
                              <Badge v-if="envVar.isSecret" variant="destructive" class="text-xs">Secret</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

            <!-- Remotes (HTTP/SSE Transport) -->
            <div v-if="displayRemotes.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">Remote Endpoints</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(remote, index) in displayRemotes"
                    :key="index"
                    class="py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex items-start gap-3">
                      <Link class="size-5 shrink-0 text-blue-500 mt-0.5" aria-hidden="true" />
                      <div class="flex-1 space-y-3">
                        <!-- Remote Type -->
                        <div class="flex items-center gap-2">
                          <Badge variant="outline" class="bg-green-50 text-green-700 border-green-200">
                            {{ remote.type || 'sse' }}
                          </Badge>
                        </div>

                        <!-- URL -->
                        <div class="space-y-1">
                          <div class="text-xs font-medium text-gray-600">Server URL:</div>
                          <code class="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono block w-fit">{{ remote.url }}</code>
                        </div>

                        <!-- Headers -->
                        <div v-if="remote.headers && remote.headers.length > 0" class="space-y-1">
                          <div class="text-xs font-medium text-gray-600">Headers:</div>
                          <div class="space-y-1">
                            <div
                              v-for="(header, headerIndex) in remote.headers"
                              :key="headerIndex"
                              class="flex items-start gap-2 text-xs"
                            >
                              <code class="bg-purple-50 text-purple-700 px-2 py-1 rounded font-mono">{{ header.name }}</code>
                              <div class="flex flex-col gap-1">
                                <div class="flex items-center gap-2">
                                  <Badge v-if="header.isRequired" variant="default" class="text-xs">Required</Badge>
                                  <Badge v-if="header.isSecret" variant="destructive" class="text-xs">Secret</Badge>
                                </div>
                                <span v-if="header.description" class="text-gray-500">{{ header.description }}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

            <!-- Template Args -->
            <div v-if="displayTemplateArgs.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">Args</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(arg, index) in displayTemplateArgs"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <Terminal class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <div class="flex items-center gap-2">
                            <code class="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono">{{ arg.value || arg }}</code>
                            <Lock v-if="arg.locked" class="h-3 w-3 text-red-500" title="Locked by global admin" />
                            <Unlock v-else class="h-3 w-3 text-green-500" title="Configurable" />
                          </div>
                          <span v-if="arg.description" class="truncate text-xs text-gray-500 mt-1">{{ arg.description }}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

            <!-- Template Headers -->
            <div v-if="displayTemplateHeaders.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">Static Headers</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(header, index) in displayTemplateHeaders"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <Terminal class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <div class="flex items-center gap-2">
                            <code class="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono">{{ header.name }}</code>
                            <Lock v-if="header.locked" class="h-3 w-3 text-red-500" title="Locked by global admin" />
                            <Unlock v-else class="h-3 w-3 text-green-500" title="Configurable" />
                          </div>
                          <div v-if="header.value" class="mt-1">
                            <code class="bg-gray-50 text-gray-600 px-2 py-1 rounded text-xs font-mono">{{ header.value }}</code>
                          </div>
                          <span v-if="header.description" class="truncate text-xs text-gray-500 mt-1">{{ header.description }}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

            <!-- Team Environment Variables -->
            <div v-if="displayTeamEnvSchema.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">Team Environment Variables</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(envVar, index) in displayTeamEnvSchema"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <Users class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <div class="flex items-center gap-2">
                            <code class="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-mono">{{ envVar.name }}</code>
                            <Badge v-if="envVar.required" variant="default" class="text-xs">Required</Badge>
                            <Badge v-else variant="secondary" class="text-xs">Optional</Badge>
                            <Lock v-if="envVar.locked" class="h-3 w-3 text-red-500" title="Locked by global admin" />
                            <Unlock v-else class="h-3 w-3 text-green-500" title="Team configurable" />
                          </div>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="text-xs text-gray-500">Type: {{ envVar.type }}</span>
                            <span v-if="!envVar.visible_to_users" class="text-xs text-orange-600">(Hidden from users)</span>
                          </div>
                          <span v-if="envVar.description" class="truncate text-xs text-gray-500 mt-1">{{ envVar.description }}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

            <!-- User Environment Variables -->
            <div v-if="displayUserEnvSchema.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">User Environment Variables</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(envVar, index) in displayUserEnvSchema"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <User class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <div class="flex items-center gap-2">
                            <code class="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-mono">{{ envVar.name }}</code>
                            <Badge v-if="envVar.required" variant="default" class="text-xs">Required</Badge>
                            <Badge v-else variant="secondary" class="text-xs">Optional</Badge>
                            <Lock v-if="envVar.locked" class="h-3 w-3 text-red-500" title="Locked by team admin" />
                            <Unlock v-else class="h-3 w-3 text-green-500" title="User configurable" />
                          </div>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="text-xs text-gray-500">Type: {{ envVar.type }}</span>
                          </div>
                          <span v-if="envVar.description" class="truncate text-xs text-gray-500 mt-1">{{ envVar.description }}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

            <!-- Team Headers -->
            <div v-if="displayTeamHeadersSchema.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">Team Headers</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(header, index) in displayTeamHeadersSchema"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <Globe class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <div class="flex items-center gap-2">
                            <code class="bg-orange-50 text-orange-700 px-2 py-1 rounded text-xs font-mono">{{ header.name }}</code>
                            <Badge v-if="header.required" variant="default" class="text-xs">Required</Badge>
                            <Badge v-else variant="secondary" class="text-xs">Optional</Badge>
                            <Lock v-if="header.locked" class="h-3 w-3 text-red-500" title="Locked by global admin" />
                            <Unlock v-else class="h-3 w-3 text-green-500" title="Team configurable" />
                          </div>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="text-xs text-gray-500">Type: {{ header.type }}</span>
                            <span v-if="!header.visible_to_users" class="text-xs text-orange-600">(Hidden from users)</span>
                          </div>
                          <span v-if="header.description" class="truncate text-xs text-gray-500 mt-1">{{ header.description }}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

            <!-- User Headers -->
            <div v-if="displayUserHeadersSchema.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">User Headers</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(header, index) in displayUserHeadersSchema"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <User class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <div class="flex items-center gap-2">
                            <code class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-mono">{{ header.name }}</code>
                            <Badge v-if="header.required" variant="default" class="text-xs">Required</Badge>
                            <Badge v-else variant="secondary" class="text-xs">Optional</Badge>
                            <Lock v-if="header.locked" class="h-3 w-3 text-red-500" title="Locked by team admin" />
                            <Unlock v-else class="h-3 w-3 text-green-500" title="User configurable" />
                          </div>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="text-xs text-gray-500">Type: {{ header.type }}</span>
                          </div>
                          <span v-if="header.description" class="truncate text-xs text-gray-500 mt-1">{{ header.description }}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

          </dl>
        </div>


        <!-- System Information Section -->
        <div class="px-4 sm:px-0 mt-8">
          <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpCatalog.edit.fields.systemInfo') }}</h3>
          <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">Server metadata and tracking information</p>
        </div>
        <div class="mt-6 border-t border-gray-100">
          <dl class="divide-y divide-gray-100">
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">Timestamps</dt>
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
                </div>
              </dd>
            </div>

            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">Identifiers</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div><span class="font-medium">{{ t('mcpCatalog.edit.values.serverId') }}</span> <span class="font-mono text-xs">{{ server.id }}</span></div>
                  <div><span class="font-medium">{{ t('mcpCatalog.edit.values.slug') }}</span> <span class="font-mono text-xs">{{ server.slug }}</span></div>
                </div>
              </dd>
            </div>
          </dl>
        </div>
      </ContentWrapper>

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
