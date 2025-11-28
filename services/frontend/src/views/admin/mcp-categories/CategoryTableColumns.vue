<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { MoreHorizontal, Edit, Trash2 } from 'lucide-vue-next'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import type { McpCategory } from '@/services/mcpCategoriesService'

const { t } = useI18n()

interface Props {
  categories: McpCategory[]
  onEditCategory: (category: McpCategory) => void
  onDeleteCategory: (categoryId: string) => void
}

const props = defineProps<Props>()

// State for delete dialog
const deleteDialogOpen = ref(false)
const categoryToDelete = ref<McpCategory | null>(null)

// Handle delete confirmation
const handleDeleteClick = (category: McpCategory) => {
  categoryToDelete.value = category
  deleteDialogOpen.value = true
}

const handleDeleteConfirm = () => {
  if (categoryToDelete.value) {
    props.onDeleteCategory(categoryToDelete.value.id)
    deleteDialogOpen.value = false
    categoryToDelete.value = null
  }
}

const handleDeleteCancel = () => {
  deleteDialogOpen.value = false
  categoryToDelete.value = null
}

// Sort categories by sort_order, then by name
const sortedCategories = computed(() => {
  return [...props.categories].sort((a, b) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order
    }
    return a.name.localeCompare(b.name)
  })
})

// Format date for display
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{{ t('mcpCategories.table.columns.name') }}</TableHead>
          <TableHead>{{ t('mcpCategories.table.columns.description') }}</TableHead>
          <TableHead>{{ t('mcpCategories.table.columns.icon') }}</TableHead>
          <TableHead>{{ t('mcpCategories.table.columns.sortOrder') }}</TableHead>
          <TableHead>{{ t('mcpCategories.table.columns.createdAt') }}</TableHead>
          <TableHead class="w-[100px]">{{ t('mcpCategories.table.columns.actions') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="sortedCategories.length === 0">
          <TableCell :colspan="6" class="h-24 text-center">
            {{ t('mcpCategories.table.noData') }}
          </TableCell>
        </TableRow>
        <TableRow v-for="category in sortedCategories" :key="category.id">
          <TableCell class="font-medium">
            {{ category.name }}
          </TableCell>
          <TableCell>
            <span v-if="category.description" class="text-sm text-muted-foreground">
              {{ category.description }}
            </span>
            <span v-else class="text-sm text-muted-foreground italic">
              {{ t('mcpCategories.table.noDescription') }}
            </span>
          </TableCell>
          <TableCell>
            <div v-if="category.icon" class="flex items-center gap-2">
              <DynamicIcon :name="category.icon" class="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" class="font-mono text-xs">
                {{ category.icon }}
              </Badge>
            </div>
            <span v-else class="text-sm text-muted-foreground">—</span>
          </TableCell>
          <TableCell>
            <Badge variant="outline">
              {{ category.sort_order }}
            </Badge>
          </TableCell>
          <TableCell class="text-sm text-muted-foreground">
            {{ formatDate(category.created_at) }}
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" class="h-8 w-8 p-0">
                  <span class="sr-only">{{ t('mcpCategories.table.openMenu') }}</span>
                  <MoreHorizontal class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="props.onEditCategory(category)">
                  <Edit class="mr-2 h-4 w-4" />
                  {{ t('mcpCategories.table.actions.edit') }}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  @click="handleDeleteClick(category)" 
                  class="text-destructive focus:text-destructive"
                >
                  <Trash2 class="mr-2 h-4 w-4" />
                  {{ t('mcpCategories.table.actions.delete') }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>

  <!-- Delete Confirmation Dialog -->
  <AlertDialog :open="deleteDialogOpen" @update:open="deleteDialogOpen = $event">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('mcpCategories.deleteDialog.title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('mcpCategories.deleteDialog.description', { categoryName: categoryToDelete?.name || '' }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="handleDeleteCancel">{{ t('mcpCategories.deleteDialog.cancel') }}</AlertDialogCancel>
        <AlertDialogAction
          @click="handleDeleteConfirm"
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {{ t('mcpCategories.deleteDialog.confirm') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
