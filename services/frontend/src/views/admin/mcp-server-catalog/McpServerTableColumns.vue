<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
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
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import {
  Edit,
  Github,
  ExternalLink
} from 'lucide-vue-next'
import type { McpServer } from './types'
import { McpCategoriesService, type McpCategory } from '@/services/mcpCategoriesService'

interface Props {
  servers: McpServer[]
  onEditServer: (serverId: string) => void
}

const props = defineProps<Props>()
const { t } = useI18n()

// Categories state
const categories = ref<McpCategory[]>([])
const categoriesLoading = ref(false)

// Fetch categories on mount
onMounted(async () => {
  try {
    categoriesLoading.value = true
    categories.value = await McpCategoriesService.getCategories()
  } catch (error) {
    console.error('Failed to fetch categories:', error)
  } finally {
    categoriesLoading.value = false
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

// Get category by ID
const getCategoryById = (categoryId?: string): McpCategory | null => {
  if (!categoryId) return null
  return categories.value.find(cat => cat.id === categoryId) || null
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
          <TableHead>{{ t('mcpCatalog.table.columns.category') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.status') }}</TableHead>
          <TableHead class="w-[100px]">{{ t('mcpCatalog.table.columns.actions') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <!-- Empty State -->
        <TableRow v-if="sortedServers.length === 0">
          <TableCell :colspan="5" class="h-24 text-center">
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

          <!-- Category -->
          <TableCell>
            <div v-if="getCategoryById(server.category_id)" class="flex items-center gap-2">
              <DynamicIcon
                :name="getCategoryById(server.category_id)?.icon || ''"
                class="h-4 w-4 text-muted-foreground"
              />
              <span class="text-sm">{{ getCategoryById(server.category_id)?.name }}</span>
            </div>
            <span v-else class="text-sm text-muted-foreground italic">
              {{ t('mcpCatalog.table.noCategory') }}
            </span>
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
