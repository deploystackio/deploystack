<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Github, ExternalLink, Package, Code, Calendar, Tag, Download, Lock, Unlock, Users, User } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import ContentWrapper from '@/components/ContentWrapper.vue'
import CategoryDisplay from '@/components/mcp-server/CategoryDisplay.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const server = ref<McpServer | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

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

// Three-tier environment variables
const displayTemplateEnvironment = computed(() => {
  if (!server.value?.template_env) return []
  try {
    // Handle both array and JSON string formats
    if (Array.isArray(server.value.template_env)) {
      return server.value.template_env
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(server.value.template_env as any)
    return parsed
  } catch {
    return []
  }
})

const displayTeamEnvironmentSchema = computed(() => {
  if (!server.value?.team_env_schema) return []
  try {
    // Handle both array and JSON string formats
    if (Array.isArray(server.value.team_env_schema)) {
      return server.value.team_env_schema
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(server.value.team_env_schema as any)
    return parsed
  } catch {
    return []
  }
})

const displayUserEnvironmentSchema = computed(() => {
  if (!server.value?.user_env_schema) return []
  try {
    // Handle both array and JSON string formats
    if (Array.isArray(server.value.user_env_schema)) {
      return server.value.user_env_schema
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(server.value.user_env_schema as any)
    return parsed
  } catch {
    return []
  }
})

const displayTransportType = computed(() => {
  return server.value?.transport_type || 'stdio'
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

const goBack = () => {
  router.push('/mcp-server')
}

const installServer = () => {
  // Navigate to installation wizard with server pre-selected
  router.push({
    path: '/mcp-server/add',
    query: {
      serverId: serverId,
      step: '2'
    }
  })
}
</script>

<template>
  <DashboardLayout :title="server ? t('mcpInstallations.view.title', { name: server.name }) : t('mcpInstallations.view.titleLoading')">
    <div class="space-y-6">
      <!-- Header with Back Button and Install Button -->
      <div class="flex items-center justify-between">
        <Button
          variant="outline"
          @click="goBack"
        >
          <ArrowLeft class="h-4 w-4 mr-2" />
          {{ t('mcpInstallations.view.backToServers') }}
        </Button>

        <Button
          v-if="server"
          @click="installServer"
          class="flex items-center gap-2"
        >
          <Download class="h-4 w-4" />
          {{ t('mcpInstallations.view.installServer') }}
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

      <!-- Server Details -->
      <ContentWrapper v-if="server">
        <div class="px-4 sm:px-0">
          <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpInstallations.view.serverInformation') }}</h3>
          <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('mcpInstallations.view.serverDetails') }}</p>
        </div>
        <div class="mt-6 border-t border-gray-100">
          <dl class="divide-y divide-gray-100">
            <!-- Server Name -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.name') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                {{ server.name }}
              </dd>
            </div>

            <!-- Description -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.description') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                {{ server.description || t('mcpInstallations.view.values.notProvided') }}
              </dd>
            </div>

            <!-- Long Description (only if different from short description) -->
            <div v-if="server.long_description && server.long_description !== server.description" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.longDescription') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="whitespace-pre-wrap">{{ server.long_description }}</div>
              </dd>
            </div>

            <!-- Category -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.category') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <CategoryDisplay
                  :category-id="server.category_id"
                  :show-not-provided="true"
                  text-class="text-sm/6"
                />
              </dd>
            </div>

            <!-- Author Information -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.author') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div><span class="font-medium">{{ t('mcpInstallations.view.values.authorName') }}</span> {{ server.author_name || t('mcpInstallations.view.values.notProvided') }}</div>
                  <div><span class="font-medium">{{ t('mcpInstallations.view.values.authorContact') }}</span> {{ server.author_contact || t('mcpInstallations.view.values.notProvided') }}</div>
                  <div><span class="font-medium">{{ t('mcpInstallations.view.values.organization') }}</span> {{ server.organization || t('mcpInstallations.view.values.notProvided') }}</div>
                </div>
              </dd>
            </div>

            <!-- Technical Specifications -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.technical') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{{ t('mcpInstallations.view.values.language') }}</span>
                    <Badge
                      variant="outline"
                      :class="getLanguageBadgeClass(server.language)"
                    >
                      {{ server.language }}
                    </Badge>
                  </div>
                  <div><span class="font-medium">{{ t('mcpInstallations.view.values.runtime') }}</span> {{ server.runtime }}</div>
                  <div><span class="font-medium">{{ t('mcpInstallations.view.values.license') }}</span> {{ server.license || t('mcpInstallations.view.values.notProvided') }}</div>
                </div>
              </dd>
            </div>

            <!-- Repository Links -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.links') }}</dt>
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
                      {{ t('mcpInstallations.view.values.repository') }}
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
                      {{ t('mcpInstallations.view.values.homepage') }}
                      <ExternalLink class="inline h-3 w-3 ml-1" />
                    </a>
                  </div>
                  <div v-if="!server.github_url && !server.homepage_url" class="text-muted-foreground">
                    {{ t('mcpInstallations.view.values.noLinks') }}
                  </div>
                </div>
              </dd>
            </div>

            <!-- Status and Classification -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.status') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{{ t('mcpInstallations.view.values.status') }}</span>
                    <Badge :variant="getStatusVariant(server.status)">
                      {{ t(`mcpInstallations.status.${server.status}`) }}
                    </Badge>
                  </div>
                  <div><span class="font-medium">{{ t('mcpInstallations.view.values.visibility') }}</span> {{ server.visibility }}</div>
                </div>
              </dd>
            </div>

            <!-- Tags -->
            <div v-if="displayTags.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.tags') }}</dt>
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
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.installation') }}</dt>
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

            <!-- Resources -->
            <div v-if="displayResources.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.resources') }}</dt>
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
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.prompts') }}</dt>
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

            <!-- Template Environment Variables -->
            <div v-if="displayTemplateEnvironment.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.templateEnvironmentVariables') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(envVar, index) in displayTemplateEnvironment"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <Lock class="size-5 shrink-0 text-red-500" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <div class="flex items-center gap-2">
                            <code class="bg-gray-50 text-gray-700 px-2 py-1 rounded text-xs font-mono">{{ envVar.name || envVar.key }}</code>
                            <Badge variant="secondary" class="text-xs">{{ t('mcpInstallations.view.values.locked') }}</Badge>
                          </div>
                          <span v-if="envVar.description" class="truncate text-xs text-gray-500 mt-1">{{ envVar.description }}</span>
                          <span v-else-if="envVar.value" class="truncate text-xs text-gray-500 mt-1">{{ envVar.value }}</span>
                          <span v-else class="truncate text-xs text-gray-500 mt-1">{{ t('mcpInstallations.view.values.staticTemplateValue') }}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </dd>
            </div>

            <!-- Team Environment Variables -->
            <div v-if="displayTeamEnvironmentSchema.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.teamEnvironmentVariables') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(envVar, index) in displayTeamEnvironmentSchema"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <Users class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <div class="flex items-center gap-2">
                            <code class="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-mono">{{ envVar.name }}</code>
                            <Badge v-if="envVar.required" variant="default" class="text-xs">{{ t('common.labels.required') }}</Badge>
                            <Badge v-else variant="secondary" class="text-xs">{{ t('common.labels.optional') }}</Badge>
                            <Badge
                              v-if="envVar.type === 'secret'"
                              variant="destructive"
                              class="text-xs"
                            >
                              {{ t('mcpInstallations.view.values.secret') }}
                            </Badge>
                            <Lock v-if="envVar.locked" class="h-3 w-3 text-red-500" :title="t('mcpInstallations.view.values.lockedByGlobalAdmin')" />
                            <Unlock v-else class="h-3 w-3 text-green-500" :title="t('mcpInstallations.view.values.teamConfigurable')" />
                          </div>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="text-xs text-gray-500">{{ t('mcpInstallations.view.values.type') }}: {{ envVar.type || 'string' }}</span>
                            <span v-if="!envVar.visible_to_users" class="text-xs text-orange-600">({{ t('mcpInstallations.view.values.hiddenFromUsers') }})</span>
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
            <div v-if="displayUserEnvironmentSchema.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.userEnvironmentVariables') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
                  <li
                    v-for="(envVar, index) in displayUserEnvironmentSchema"
                    :key="index"
                    class="flex items-center justify-between py-4 pr-5 pl-4 text-sm/6"
                  >
                    <div class="flex w-0 flex-1 items-center">
                      <User class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div class="ml-4 flex min-w-0 flex-1 gap-2">
                        <div class="flex flex-col">
                          <div class="flex items-center gap-2">
                            <code class="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-mono">{{ envVar.name }}</code>
                            <Badge v-if="envVar.required" variant="default" class="text-xs">{{ t('common.labels.required') }}</Badge>
                            <Badge v-else variant="secondary" class="text-xs">{{ t('common.labels.optional') }}</Badge>
                            <Badge
                              v-if="envVar.type === 'secret'"
                              variant="destructive"
                              class="text-xs"
                            >
                              {{ t('mcpInstallations.view.values.secret') }}
                            </Badge>
                            <Lock v-if="envVar.locked" class="h-3 w-3 text-red-500" :title="t('mcpInstallations.view.values.lockedByTeamAdmin')" />
                            <Unlock v-else class="h-3 w-3 text-green-500" :title="t('mcpInstallations.view.values.userConfigurable')" />
                          </div>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="text-xs text-gray-500">{{ t('mcpInstallations.view.values.type') }}: {{ envVar.type || 'string' }}</span>
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
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.transportType') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <Badge variant="outline" class="font-mono">
                  {{ displayTransportType }}
                </Badge>
              </dd>
            </div>

            <!-- System Information -->
            <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.view.fields.systemInfo') }}</dt>
              <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
                <div class="space-y-2">
                  <div class="flex items-center gap-1">
                    <Calendar class="h-4 w-4 text-muted-foreground" />
                    <span class="font-medium">{{ t('mcpInstallations.view.values.created') }}</span> {{ formatDate(server.created_at) }}
                  </div>
                  <div class="flex items-center gap-1">
                    <Calendar class="h-4 w-4 text-muted-foreground" />
                    <span class="font-medium">{{ t('mcpInstallations.view.values.updated') }}</span> {{ formatDate(server.updated_at) }}
                  </div>
                  <div v-if="server.last_sync_at" class="flex items-center gap-1">
                    <Calendar class="h-4 w-4 text-muted-foreground" />
                    <span class="font-medium">{{ t('mcpInstallations.view.values.lastSync') }}</span> {{ formatDate(server.last_sync_at) }}
                  </div>
                  <div><span class="font-medium">{{ t('mcpInstallations.view.values.serverId') }}</span> <span class="font-mono text-xs">{{ server.id }}</span></div>
                  <div><span class="font-medium">{{ t('mcpInstallations.view.values.slug') }}</span> <span class="font-mono text-xs">{{ server.slug }}</span></div>
                </div>
              </dd>
            </div>
          </dl>
        </div>
      </ContentWrapper>
    </div>
  </DashboardLayout>
</template>
