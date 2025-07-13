<script setup lang="ts">
import { computed } from 'vue'
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
  Star,
  StarOff,
  Github,
  ExternalLink
} from 'lucide-vue-next'
import type { McpServer } from './types'

interface Props {
  servers: McpServer[]
  onEditServer: (serverId: string) => void
  onToggleFeatured: (serverId: string, featured: boolean) => void
}

const props = defineProps<Props>()
const { t } = useI18n()

// Format date for display
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

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

// Sort servers by name for consistency
const sortedServers = computed(() => {
  return [...props.servers].sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{{ t('mcpCatalog.table.columns.name') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.description') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.language') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.runtime') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.status') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.featured') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.created') }}</TableHead>
          <TableHead class="w-[100px]">{{ t('mcpCatalog.table.columns.actions') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <!-- Empty State -->
        <TableRow v-if="sortedServers.length === 0">
          <TableCell :colspan="8" class="h-24 text-center">
            {{ t('mcpCatalog.table.noData') }}
          </TableCell>
        </TableRow>

        <!-- Data Rows -->
        <TableRow v-for="server in sortedServers" :key="server.id">
          <!-- Name -->
          <TableCell class="font-medium">
            <div class="space-y-1">
              <div>{{ server.name }}</div>
              <div v-if="server.author_name" class="text-sm text-muted-foreground">
                by {{ server.author_name }}
              </div>
              <div v-if="server.github_url" class="flex items-center gap-1">
                <Github class="h-3 w-3 text-muted-foreground" />
                <a
                  :href="server.github_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-blue-600 hover:underline"
                >
                  Repository
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

          <!-- Language -->
          <TableCell>
            <Badge
              variant="outline"
              :class="getLanguageBadgeClass(server.language)"
            >
              {{ server.language }}
            </Badge>
          </TableCell>

          <!-- Runtime -->
          <TableCell>
            <div class="text-sm">
              {{ server.runtime }}
              <div v-if="server.runtime_min_version" class="text-xs text-muted-foreground">
                {{ server.runtime_min_version }}+
              </div>
            </div>
          </TableCell>

          <!-- Status -->
          <TableCell>
            <Badge :variant="getStatusVariant(server.status)">
              {{ t(`mcpCatalog.status.${server.status}`) }}
            </Badge>
          </TableCell>

          <!-- Featured -->
          <TableCell>
            <Button
              variant="ghost"
              size="sm"
              @click="props.onToggleFeatured(server.id, !server.featured)"
              class="h-8 w-8 p-0"
            >
              <Star
                v-if="server.featured"
                class="h-4 w-4 fill-yellow-400 text-yellow-400"
              />
              <StarOff
                v-else
                class="h-4 w-4 text-muted-foreground"
              />
            </Button>
          </TableCell>

          <!-- Created -->
          <TableCell class="text-sm text-muted-foreground">
            {{ formatDate(server.created_at) }}
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
