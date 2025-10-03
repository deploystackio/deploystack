<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Edit,
  Github,
  GitBranch,
  Globe,
  ExternalLink
} from 'lucide-vue-next'
import type { McpServer } from './types'

interface Props {
  servers: McpServer[]
  onEditServer: (serverId: string) => void
}

const props = defineProps<Props>()
const { t } = useI18n()

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

// Get runtime badge color
const getRuntimeBadgeClass = (runtime: string) => {
  const colors: Record<string, string> = {
    'node.js': 'bg-green-100 text-green-800',
    node: 'bg-green-100 text-green-800',
    python: 'bg-blue-100 text-blue-800',
    docker: 'bg-cyan-100 text-cyan-800',
    go: 'bg-cyan-100 text-cyan-800',
    rust: 'bg-orange-100 text-orange-800',
    java: 'bg-red-100 text-red-800',
    '.net': 'bg-purple-100 text-purple-800',
    dotnet: 'bg-purple-100 text-purple-800',
  }
  return colors[runtime.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

// Get repository icon based on platform
const getRepositoryIcon = (platform?: string) => {
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
const getRepositoryLabel = (platform?: string) => {
  switch (platform) {
    case 'github':
      return 'Repository'
    case 'gitlab':
      return 'GitLab'
    case 'bitbucket':
      return 'Bitbucket'
    default:
      return 'Repository'
  }
}
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{{ t('mcpCatalog.table.columns.name') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.description') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.runtime') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.status') }}</TableHead>
          <TableHead class="w-[100px]">{{ t('mcpCatalog.table.columns.actions') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <!-- Empty State -->
        <TableRow v-if="props.servers.length === 0">
          <TableCell :colspan="5" class="h-24 text-center">
            {{ t('mcpCatalog.table.noData') }}
          </TableCell>
        </TableRow>

        <!-- Data Rows -->
        <TableRow v-for="server in props.servers" :key="server.id">
          <!-- Name -->
          <TableCell class="font-medium">
            <div class="space-y-1">
              <div>{{ server.name }}</div>
              <div v-if="server.author_name" class="text-sm text-muted-foreground">
                by {{ server.author_name }}
              </div>
              <!-- Repository Link -->
              <div v-if="server.repository_url" class="flex items-center gap-1">
                <component
                  :is="getRepositoryIcon(server.repository_source)"
                  class="h-3 w-3 text-muted-foreground"
                />
                <a
                  :href="server.repository_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-blue-600 hover:underline"
                >
                  {{ getRepositoryLabel(server.repository_source) }}
                  <ExternalLink class="inline h-3 w-3 ml-1" />
                </a>
              </div>
            </div>
          </TableCell>

          <!-- Description -->
          <TableCell>
            <div class="max-w-xs">
              <span v-if="server.description" class="text-sm text-muted-foreground line-clamp-2">
                {{ server.description }}
              </span>
              <span v-else class="text-sm text-muted-foreground italic">
                {{ t('mcpCatalog.table.noDescription') }}
              </span>
              <div v-if="server.tags && server.tags.length > 0" class="flex flex-wrap gap-1 mt-2">
                <Badge
                  v-for="tag in server.tags.slice(0, 3)"
                  :key="tag"
                  variant="outline"
                  class="text-xs"
                >
                  {{ tag }}
                </Badge>
                <span v-if="server.tags.length > 3" class="text-xs text-muted-foreground">
                  +{{ server.tags.length - 3 }} more
                </span>
              </div>
            </div>
          </TableCell>

          <!-- Runtime -->
          <TableCell>
            <Badge
              variant="outline"
              :class="getRuntimeBadgeClass(server.runtime)"
            >
              {{ server.runtime }}
            </Badge>
          </TableCell>

          <!-- Status -->
          <TableCell>
            <Badge :variant="getStatusVariant(server.status)">
              {{ t(`mcpCatalog.status.${server.status}`) }}
            </Badge>
          </TableCell>

          <!-- Actions -->
          <TableCell>
            <Button
              variant="outline"
              size="sm"
              @click="props.onEditServer(server.id)"
              class="h-8"
            >
              <Edit class="h-4 w-4 mr-2" />
              {{ t('mcpCatalog.table.actions.manage') }}
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
