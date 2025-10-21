<!--
 * SHARED ARGUMENTS CONFIGURATION SECTION
 *
 * This component extracts the duplicated template code for arguments configuration.
 * No logic duplication - just the UI template that can be shared across components.
 -->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, MoreHorizontal, Terminal, Lock } from 'lucide-vue-next'

const { t } = useI18n()

// Simple interface for argument items (reusing existing structure)
interface ArgumentItem {
  id: string
  name: string
  value?: string
  description: string
  dataType: string
  category: string
  required: boolean
  locked: boolean
}

interface Props {
  items: ArgumentItem[]
  getCategoryInfo: (category: string) => {
    label: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: any
    color: string
  }
}

defineProps<Props>()
const emit = defineEmits<{
  'add': []
  'edit': [index: number]
  'delete': [index: number]
}>()
</script>

<template>
  <div class="space-y-4">
    <div>
      <h4 class="text-md font-medium">{{ t('mcpCatalog.form.configurationSchema.arguments.title') }}</h4>
      <p class="text-sm text-muted-foreground">
        {{ t('mcpCatalog.form.configurationSchema.arguments.description') }}
      </p>
    </div>

    <!-- Header with Add Button -->
    <div class="flex items-center justify-between">
      <div></div>
      <Button
        type="button"
        @click="emit('add')"
        class="flex items-center gap-2"
      >
        <Plus class="h-4 w-4" />
        {{ t('mcpCatalog.form.configurationSchema.arguments.addButton') }}
      </Button>
    </div>

    <!-- Arguments Display with Edit Actions -->
    <div v-if="items.length > 0" class="overflow-hidden">
      <table class="w-full text-left">
        <thead class="sr-only">
          <tr>
            <th>Name</th>
            <th class="hidden sm:table-cell">Properties</th>
            <th class="hidden sm:table-cell">Details</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in items" :key="item.id">
            <td class="relative py-5 pr-6">
              <div class="flex gap-x-6">
                <div class="flex-auto">
                  <div class="flex items-start gap-x-3">
                    <div class="text-sm/6 font-semibold text-gray-900">
                      {{ item.name }}
                    </div>
                  </div>
                  <Badge :class="`bg-${getCategoryInfo(item.category).color}-100 text-${getCategoryInfo(item.category).color}-800 mt-1`">
                    {{ getCategoryInfo(item.category).label }}
                  </Badge>
                  <div v-if="item.value && item.value !== item.name" class="mt-1 font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block">
                    {{ item.value }}
                  </div>
                </div>
              </div>
              <div class="absolute right-full bottom-0 h-px w-screen bg-gray-100" />
              <div class="absolute bottom-0 left-0 h-px w-screen bg-gray-100" />
            </td>
            <td class="hidden py-5 pr-6 sm:table-cell">
              <div class="space-y-1">
                <div class="text-xs/5 text-gray-500">
                  <span class="font-medium">{{ $t('mcpCatalog.form.configurationSchema.table.properties.type') }}</span> {{ item.dataType }}
                </div>
                <div v-if="item.required" class="text-xs/5 text-gray-500">
                  <span class="font-medium">{{ $t('mcpCatalog.form.configurationSchema.table.properties.required') }}</span> {{ $t('mcpCatalog.form.configurationSchema.table.properties.yes') }}
                </div>
                <div v-if="item.locked" class="text-xs/5 text-gray-500 flex items-center gap-1">
                  <Lock class="w-3 h-3" />
                  <span class="font-medium">{{ $t('mcpCatalog.form.configurationSchema.table.properties.locked') }}</span>
                </div>
              </div>
            </td>
            <td class="hidden py-5 pr-6 sm:table-cell">
              <div v-if="item.description" class="text-sm/6 text-gray-900">
                {{ item.description }}
              </div>
            </td>
            <td class="py-5 text-right">
              <div class="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" class="h-8 w-8 p-0">
                      <span class="sr-only">{{ $t('mcpCatalog.form.configurationSchema.table.actions.openMenu') }}</span>
                      <MoreHorizontal class="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click="emit('edit', index)">
                      <Edit class="mr-2 h-4 w-4" />
                      {{ $t('mcpCatalog.form.configurationSchema.table.actions.edit') }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      @click="emit('delete', index)"
                      class="text-red-600 focus:text-red-600"
                    >
                      <Trash2 class="mr-2 h-4 w-4" />
                      {{ $t('mcpCatalog.form.configurationSchema.table.actions.delete') }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Arguments Empty State -->
    <div v-else class="text-center py-12">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
        <Terminal class="h-6 w-6 text-gray-400" />
      </div>
      <h3 class="text-sm font-medium text-gray-900 mb-2">{{ t('mcpCatalog.form.configurationSchema.arguments.emptyState.title') }}</h3>
      <p class="text-sm text-gray-500 max-w-sm mx-auto">
        {{ t('mcpCatalog.form.configurationSchema.arguments.emptyState.description') }}
      </p>
    </div>
  </div>
</template>
