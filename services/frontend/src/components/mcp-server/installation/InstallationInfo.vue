<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Badge } from '@/components/ui/badge'
import { Github, ExternalLink, Calendar, Tag } from 'lucide-vue-next'
import type { McpInstallation } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
}

const props = defineProps<Props>()
const { t } = useI18n()

// Computed properties for display (using installation.server data)
const server = computed(() => props.installation?.server || null)

const displayTags = computed(() => {
  if (!server.value?.tags || server.value.tags.length === 0) return []
  return Array.isArray(server.value.tags) ? server.value.tags : []
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
const getLanguageBadgeClass = (language: string | undefined) => {
  if (!language) return 'bg-gray-100 text-gray-800'

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
</script>

<template>
  <div v-if="installation && server">
    <div class="px-4 sm:px-0">
      <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpInstallations.details.installationDetails.title') }}</h3>
      <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('mcpInstallations.details.installationDetails.description') }}</p>
    </div>
    <div class="mt-6 border-t border-gray-100">
      <dl class="divide-y divide-gray-100">
        <!-- Installation Name -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.installationName') }}</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ installation.installation_name }}
          </dd>
        </div>

        <!-- Server Name -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.server') }}</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ server.name }}
          </dd>
        </div>

        <!-- Description -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.description') }}</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ server.description || t('mcpInstallations.details.installationDetails.values.noDescription') }}
          </dd>
        </div>

        <!-- Installation Type -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.installationType') }}</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <Badge :variant="installation.installation_type === 'local' ? 'default' : 'secondary'">
              {{ installation.installation_type }}
            </Badge>
          </dd>
        </div>

        <!-- Technical Specifications -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.technicalDetails') }}</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.language') }}</span>
                <Badge
                  variant="outline"
                  :class="getLanguageBadgeClass(server.language)"
                >
                  {{ server.language || 'Unknown' }}
                </Badge>
              </div>
              <div><span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.runtime') }}</span> {{ server.runtime }}</div>
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.status') }}</span>
                <Badge :variant="getStatusVariant(server.status)">
                  {{ server.status }}
                </Badge>
              </div>
            </div>
          </dd>
        </div>

        <!-- Repository Links -->
        <div v-if="server.github_url || server.homepage_url" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.links') }}</dt>
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
                  {{ t('mcpInstallations.details.installationDetails.fields.repository') }}
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
                  {{ t('mcpInstallations.details.installationDetails.fields.homepage') }}
                  <ExternalLink class="inline h-3 w-3 ml-1" />
                </a>
              </div>
            </div>
          </dd>
        </div>

        <!-- Author Information -->
        <div v-if="server.author_name" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.author') }}</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            {{ server.author_name }}
          </dd>
        </div>

        <!-- Tags -->
        <div v-if="displayTags.length > 0" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.tags') }}</dt>
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

        <!-- Installation Dates -->
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm/6 font-medium text-gray-900">{{ t('mcpInstallations.details.installationDetails.fields.installationInfo') }}</dt>
          <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
            <div class="space-y-2">
              <div class="flex items-center gap-1">
                <Calendar class="h-4 w-4 text-muted-foreground" />
                <span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.installed') }}</span> {{ formatDate(installation.created_at) }}
              </div>
              <div class="flex items-center gap-1">
                <Calendar class="h-4 w-4 text-muted-foreground" />
                <span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.updated') }}</span> {{ formatDate(installation.updated_at) }}
              </div>
              <div v-if="installation.last_used_at" class="flex items-center gap-1">
                <Calendar class="h-4 w-4 text-muted-foreground" />
                <span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.lastUsed') }}</span> {{ formatDate(installation.last_used_at) }}
              </div>
              <div><span class="font-medium">{{ t('mcpInstallations.details.installationDetails.fields.installationId') }}</span> <span class="font-mono text-xs">{{ installation.id }}</span></div>
            </div>
          </dd>
        </div>
      </dl>
    </div>
  </div>
</template>
