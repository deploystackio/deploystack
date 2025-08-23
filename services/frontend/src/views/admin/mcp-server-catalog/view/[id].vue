<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import CategoryDisplay from '@/components/mcp-server/CategoryDisplay.vue'
import ContentWrapper from '@/components/ContentWrapper.vue'
import { ArrowLeft, Github, ExternalLink, Package, Settings, Calendar, Tag, Trash2, AlertTriangle, Edit, Terminal, Users, User, Lock, Unlock } from 'lucide-vue-next'
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



const displayTemplateArgs = computed(() => {
  if (!server.value?.template_args) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.template_args)) {
    return server.value.template_args
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(server.value.template_args as any)
  } catch {
    return []
  }
})

const displayTeamEnvSchema = computed(() => {
  if (!server.value?.team_env_schema) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.team_env_schema)) {
    return server.value.team_env_schema
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(server.value.team_env_schema as any)
  } catch {
    return []
  }
})

const displayUserEnvSchema = computed(() => {
  if (!server.value?.user_env_schema) return []
  // Handle both array and JSON string formats
  if (Array.isArray(server.value.user_env_schema)) {
    return server.value.user_env_schema
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(server.value.user_env_schema as any)
  } catch {
    return []
  }
})

const displayTransportType = computed(() => {
  return server.value?.transport_type || t('mcpCatalog.edit.values.transportType.notSpecified')
})

const displayDependencies = computed(() => {
  if (!server.value?.dependencies) return null
  // Handle both object and JSON string formats
  if (typeof server.value.dependencies === 'object') {
    return server.value.dependencies
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(server.value.dependencies as any)
  } catch {
    return null
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

// Navigate to edit page
const handleEditServer = () => {
  router.push(`/admin/mcp-server-catalog/edit/${serverId}`)
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

          </dl>
        </div>



        <!-- Installation & Configuration Section -->
        <div class="px-4 sm:px-0 mt-8">
          <h3 class="text-base/7 font-semibold text-gray-900">Installation & Configuration</h3>
          <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">Installation methods and configuration options</p>
        </div>
        <div class="mt-6 border-t border-gray-100">
          <dl class="divide-y divide-gray-100">
            <!-- Installation Methods -->
            <div v-if="displayInstallationMethods.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.installation') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(method, index) in displayInstallationMethods"
                    :key="index"
                    class="py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex items-start gap-3">
                      <Package class="size-5 shrink-0 text-gray-400 mt-0.5" aria-hidden="true" />
                      <div class="flex-1 space-y-3">
                        <!-- Client and Command -->
                        <div class="flex items-center gap-2">
                          <span class="font-medium">{{ method.client || 'Unknown Client' }}</span>
                          <span class="text-gray-500">•</span>
                          <code class="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{{ method.command }}</code>
                        </div>

                        <!-- Arguments -->
                        <div v-if="method.args && method.args.length > 0" class="space-y-1">
                          <div class="text-xs font-medium text-gray-600">Arguments:</div>
                          <div class="flex flex-wrap gap-1">
                            <code
                              v-for="(arg, argIndex) in method.args"
                              :key="argIndex"
                              class="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono"
                            >
                              {{ arg }}
                            </code>
                          </div>
                        </div>

                        <!-- Environment Variables -->
                        <div v-if="method.env && Object.keys(method.env).length > 0" class="space-y-1">
                          <div class="text-xs font-medium text-gray-600">Environment Variables:</div>
                          <div class="space-y-1">
                            <div
                              v-for="(value, key) in method.env"
                              :key="key"
                              class="flex items-center gap-2 text-xs"
                            >
                              <code class="bg-green-50 text-green-700 px-2 py-1 rounded font-mono">{{ key }}</code>
                              <span class="text-gray-400">=</span>
                              <code class="bg-gray-50 text-gray-600 px-2 py-1 rounded font-mono">{{ value }}</code>
                            </div>
                          </div>
                        </div>

                        <!-- Full Command Preview -->
                        <div class="bg-gray-50 rounded-md p-2">
                          <div class="text-xs font-medium text-gray-600 mb-1">Command Preview:</div>
                          <code class="text-xs font-mono text-gray-800">
                            {{ method.command }}{{ method.args && method.args.length > 0 ? ' ' + method.args.join(' ') : '' }}
                          </code>
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

            <!-- Dependencies -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpCatalog.edit.fields.dependencies') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div v-if="displayDependencies && Object.keys(displayDependencies).length > 0" class="bg-gray-50 rounded-md p-4">
                  <pre class="text-xs text-gray-800 whitespace-pre-wrap font-mono">{{ JSON.stringify(displayDependencies, null, 2) }}</pre>
                </div>
                <div v-else class="text-sm text-gray-500 italic">
                  {{ t('mcpCatalog.edit.values.notProvided') }}
                </div>
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
