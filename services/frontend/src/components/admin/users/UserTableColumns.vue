<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
import { ButtonGroup } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, Github, Eye, Search, SlidersHorizontal, X } from 'lucide-vue-next'
import type { User } from '@/views/admin/users/types'

const { t } = useI18n()

interface Props {
  users: User[]
  searchQuery: string
  isSearching: boolean
  isLoading: boolean
  visibleFilters: Set<string>
  filterValues: Record<string, string>
  onViewUser: (userId: string) => void
}

interface Emits {
  (e: 'update:searchQuery', value: string): void
  (e: 'update:searchType', value: 'username' | 'email'): void
  (e: 'search'): void
  (e: 'filter-change', filters: Record<string, string>): void
  (e: 'visible-filters-change', filters: Set<string>): void
  (e: 'filter-values-change', values: Record<string, string>): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Handler for search query updates
const handleSearchQueryUpdate = (value: string | number) => {
  emit('update:searchQuery', String(value))
}

// Search type selector
const searchType = ref<'username' | 'email'>('username')

const searchTypeOptions = computed(() => [
  { value: 'username', label: t('adminUsers.table.search.byUsername') },
  { value: 'email', label: t('adminUsers.table.search.byEmail') }
])

// Watch for search type changes and emit
watch(searchType, (newType) => {
  emit('update:searchType', newType)
})

// Filter types
type FilterType = 'role' | 'auth_type'

// Helper to update a single filter value
const updateFilterValue = (filter: FilterType, value: string) => {
  const newValues = { ...props.filterValues, [filter]: value }
  emit('filter-values-change', newValues)
  // Also emit filter-change for the parent to trigger search
  const active: Record<string, string> = {}
  for (const [key, val] of Object.entries(newValues)) {
    if (val) {
      active[key] = val
    }
  }
  emit('filter-change', active)
}

// Toggle filter visibility (using prop from parent)
const toggleFilter = (filter: FilterType) => {
  const newFilters = new Set(props.visibleFilters)
  if (newFilters.has(filter)) {
    newFilters.delete(filter)
  } else {
    newFilters.add(filter)
  }
  emit('visible-filters-change', newFilters)
}

// Remove filter (reset value and hide)
const removeFilter = (filter: FilterType) => {
  // Reset value and emit
  const newValues = { ...props.filterValues, [filter]: '' }
  emit('filter-values-change', newValues)
  // Hide the filter
  const newFilters = new Set(props.visibleFilters)
  newFilters.delete(filter)
  emit('visible-filters-change', newFilters)
  // Emit filter-change to trigger search
  const active: Record<string, string> = {}
  for (const [key, val] of Object.entries(newValues)) {
    if (val) {
      active[key] = val
    }
  }
  emit('filter-change', active)
}

// Check if any filters are visible (using prop)
const hasVisibleFilters = computed(() => props.visibleFilters.size > 0)

// Sort users by name for consistency
const sortedUsers = computed(() => {
  return [...props.users].sort((a, b) => {
    const nameA = getDisplayName(a)
    const nameB = getDisplayName(b)
    return nameA.localeCompare(nameB)
  })
})

// Get display name for user
const getDisplayName = (user: User) => {
  const firstName = user.first_name || ''
  const lastName = user.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || user.username
}

// Get auth type badge variant and icon
const getAuthTypeInfo = (authType: string | null) => {
  const isEmail = authType === 'email_signup' || authType === 'email'
  return {
    variant: (isEmail ? 'default' : 'secondary') as 'default' | 'secondary',
    icon: isEmail ? Mail : Github,
    label: isEmail ? 'Email' : 'GitHub'
  }
}
</script>

<template>
  <div>
    <!-- Search and Filters -->
    <div class="flex items-center justify-between mb-5">
      <!-- Search Input with Type Selector -->
      <ButtonGroup class="w-96">
        <Select v-model="searchType">
          <SelectTrigger class="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in searchTypeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <div class="relative flex-1">
          <Input
            :model-value="searchQuery"
            :placeholder="isSearching ? t('adminUsers.table.search.searching') : t('adminUsers.table.search.placeholder')"
            :disabled="isSearching"
            @update:model-value="handleSearchQueryUpdate"
            @keyup.enter="emit('search')"
            class="rounded-l-none border-l-0 pr-9"
          />
          <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Spinner v-if="isSearching" class="h-4 w-4" />
            <Search v-else class="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </ButtonGroup>

      <!-- Right side: Filters DropdownMenu -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            class="h-9 flex items-center gap-2"
          >
            <SlidersHorizontal class="h-4 w-4" />
            {{ t('adminUsers.filters.button') }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="toggleFilter('auth_type')">
            {{ t('adminUsers.filters.authType.label') }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="toggleFilter('role')">
            {{ t('adminUsers.filters.role.label') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- Active Filters Row (below search) -->
    <div v-if="hasVisibleFilters" class="flex flex-wrap gap-2 pb-4">
      <!-- Auth Type Filter -->
      <div v-if="props.visibleFilters.has('auth_type')" class="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
        <span class="text-sm font-medium whitespace-nowrap">{{ t('adminUsers.filters.authType.label') }}</span>
        <Select :model-value="props.filterValues.auth_type" @update:model-value="(v) => updateFilterValue('auth_type', String(v ?? ''))">
          <SelectTrigger class="h-7 w-37.5">
            <SelectValue :placeholder="t('adminUsers.filters.authType.placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email_signup">Email</SelectItem>
            <SelectItem value="github">GitHub</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" class="h-6 w-6" @click="removeFilter('auth_type')">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <!-- Role Filter -->
      <div v-if="props.visibleFilters.has('role')" class="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
        <span class="text-sm font-medium whitespace-nowrap">{{ t('adminUsers.filters.role.label') }}</span>
        <Select :model-value="props.filterValues.role" @update:model-value="(v) => updateFilterValue('role', String(v ?? ''))">
          <SelectTrigger class="h-7 w-37.5">
            <SelectValue :placeholder="t('adminUsers.filters.role.placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global_admin">Global Admin</SelectItem>
            <SelectItem value="global_user">Global User</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" class="h-6 w-6" @click="removeFilter('role')">
          <X class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="rounded-md border">
      <div class="p-4 space-y-3">
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-full" />
      </div>
    </div>

    <!-- Data Table -->
    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('adminUsers.table.columns.registration') }}</TableHead>
            <TableHead>{{ t('adminUsers.table.columns.name') }}</TableHead>
            <TableHead>{{ t('adminUsers.table.columns.email') }}</TableHead>
            <TableHead>{{ t('adminUsers.table.columns.role') }}</TableHead>
            <TableHead class="w-[100px]">{{ t('adminUsers.table.columns.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <!-- Empty State -->
          <TableRow v-if="sortedUsers.length === 0">
            <TableCell :colspan="5" class="h-24 text-center">
              {{ t('adminUsers.table.noResults') }}
            </TableCell>
          </TableRow>

          <!-- Data Rows -->
          <TableRow v-for="user in sortedUsers" :key="user.id">
            <!-- Registration Type -->
            <TableCell>
              <Badge
                :variant="getAuthTypeInfo(user.auth_type).variant"
                class="flex items-center gap-1 w-fit"
              >
                <component
                  :is="getAuthTypeInfo(user.auth_type).icon"
                  class="h-3 w-3"
                />
                {{ getAuthTypeInfo(user.auth_type).label }}
              </Badge>
            </TableCell>

            <!-- Name -->
            <TableCell class="font-medium">
              {{ getDisplayName(user) }}
            </TableCell>

            <!-- Email -->
            <TableCell>
              <div class="font-mono text-sm">
                {{ user.email }} ({{ user.username }})
              </div>
            </TableCell>

            <!-- Role -->
            <TableCell>
              <span v-if="user.role" class="text-sm">
                {{ user.role.name }}
              </span>
              <span v-else class="text-sm text-muted-foreground italic">
                {{ t('adminUsers.table.noRole') }}
              </span>
            </TableCell>

            <!-- Actions -->
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                @click="onViewUser(user.id)"
                class="h-8 px-3"
              >
                <Eye class="h-4 w-4 mr-1" />
                {{ t('adminUsers.table.actions.view') }}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
