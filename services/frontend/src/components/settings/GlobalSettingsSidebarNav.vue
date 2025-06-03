<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button' // Adjusted path assuming shadcn/ui components are in @/components/ui

export interface Setting {
  key: string
  value: any
  description?: string
  is_encrypted?: boolean
  group_id?: string
  // Add other potential fields like 'required', 'type' if known/needed
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
  <nav class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
    <Button
      v-for="item in sidebarNavItems"
      :key="item.title"
      as-child
      variant="ghost"
      :class="cn(
        'w-full text-left justify-start',
        route.path === item.href && 'bg-muted hover:bg-muted',
      )"
    >
      <RouterLink :to="item.href">
        {{ item.title }}
      </RouterLink>
    </Button>
  </nav>
</template>
