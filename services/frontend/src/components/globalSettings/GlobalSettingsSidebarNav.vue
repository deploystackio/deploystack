<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button' // Adjusted path assuming shadcn/ui components are in @/components/ui

export interface Setting {
  key: string
  name?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
  type: 'string' | 'number' | 'boolean'
  description?: string
  is_encrypted?: boolean
  group_id?: string
}

export interface GlobalSettingGroup {
  id: string
  name: string
  description?: string
  icon?: string
  sort_order?: number
  settings?: Setting[]
}

interface NavItem {
  title: string
  href: string
}

const props = defineProps<{
  groups: GlobalSettingGroup[]
}>()

const route = useRoute()

const sidebarNavItems = computed((): NavItem[] => {
  return props.groups.map(group => ({
    title: group.name,
    href: `/admin/settings/${group.id}`,
  })).sort((a, b) => {
    // Assuming groups are already sorted by sort_order by the parent or API
    // If not, and sort_order is available on GlobalSettingGroup, sort here
    return a.title.localeCompare(b.title) // Fallback sort by title
  })
})
</script>

<template>
  <nav class="flex space-x-2 md:flex-col md:space-x-0 md:space-y-1">
    <Button
      v-for="item in sidebarNavItems"
      :key="item.title"
      as-child
      variant="ghost"
      :class="cn(
        'w-full text-left justify-start border hover:bg-white',
        route.path === item.href ? 'bg-white font-medium !border-primary' : 'border-sidebar-foreground/20',
      )"
    >
      <RouterLink :to="item.href">
        {{ item.title }}
      </RouterLink>
    </Button>
  </nav>
</template>
