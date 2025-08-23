<!--
 * SHARED ENVIRONMENT VARIABLES CONFIGURATION SECTION
 * 
 * This component extracts ONLY the duplicated template code for environment variables.
 * No logic duplication - just the UI template that was identical in both components.
 -->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Settings, MoreHorizontal, Lock } from 'lucide-vue-next'

// Simple interface for environment items (reusing existing structure)
interface EnvItem {
  id: string
  name: string
  description: string
  dataType: string
  category: string
  required: boolean
  locked: boolean
  visible_to_users?: boolean
}

interface Props {
  items: EnvItem[]
  getCategoryInfo: (category: string) => {
    label: string
    icon: any
    color: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'add': []
  'edit': [index: number]
  'delete': [index: number]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <div>
      <h4 class="text-md font-medium">{{ $t('mcpCatalog.form.configurationSchema.environment.title') }}</h4>
      <p class="text-sm text-muted-foreground">
        {{ $t('mcpCatalog.form.configurationSchema.environment.description') }}
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
        {{ $t('mcpCatalog.form.configurationSchema.environment.addButton') }}
      </Button>
    </div>

    <!-- Environment Variables Display with Edit Actions -->
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
                    <div class="text-sm/6 font-semibold text-gray-900 font-mono">
                      {{ item.name }}
                    </div>
                    <Badge :class="`bg-${getCategoryInfo(item.category).color}-100 text-${getCategoryInfo(item.category).color}-800`">
                      <component :is="getCategoryInfo(item.category).icon" class="w-3 h-3 mr-1" />
                      {{ getCategoryInfo(item.category).label }}
                    </Badge>
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
                <div v-if="item.visible_to_users" class="text-xs/5 text-gray-500">
                  <span class="font-medium">{{ $t('mcpCatalog.form.configurationSchema.table.properties.visibleToUsers') }}</span> {{ $t('mcpCatalog.form.configurationSchema.table.properties.yes') }}
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

    <!-- Environment Variables Empty State -->
    <div v-else class="text-center py-12">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
        <Settings class="h-6 w-6 text-gray-400" />
      </div>
      <h3 class="text-sm font-medium text-gray-900 mb-2">{{ $t('mcpCatalog.form.configurationSchema.environment.emptyState.title') }}</h3>
      <p class="text-sm text-gray-500 max-w-sm mx-auto">
        {{ $t('mcpCatalog.form.configurationSchema.environment.emptyState.description') }}
      </p>
    </div>
  </div>
</template>
