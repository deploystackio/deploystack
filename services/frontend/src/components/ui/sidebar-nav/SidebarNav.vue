<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Component } from 'vue'

export interface NavItem {
  title: string
  href: string
  icon?: Component
  iconPath?: string
  badge?: string | number
  disabled?: boolean
}

interface Props {
  items: NavItem[]
  variant?: 'default' | 'compact'
  orientation?: 'vertical' | 'horizontal'
  activeItemBorderColor?: 'primary' | 'secondary' | 'accent'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  orientation: 'vertical',
  activeItemBorderColor: 'primary'
})

const route = useRoute()

const isItemActive = (href: string): boolean => {
  return route.path === href
}

const borderColorClass = computed(() => {
  const colorMap = {
    primary: '!border-primary',
    secondary: '!border-secondary',
    accent: '!border-accent'
  }
  return colorMap[props.activeItemBorderColor]
})

const navContainerClass = computed(() => {
  return cn(
    'flex',
    props.orientation === 'vertical'
      ? 'flex-col space-y-1'
      : 'flex-row space-x-2',
    // Responsive: horizontal on mobile, vertical on desktop
    'space-x-2 md:flex-col md:space-x-0 md:space-y-1'
  )
})
</script>

<template>
  <nav :class="navContainerClass">
    <Button
      v-for="item in items"
      :key="item.href"
      as-child
      variant="ghost"
      :disabled="item.disabled"
      :class="cn(
        'w-full text-left justify-start border hover:bg-white',
        isItemActive(item.href)
          ? cn('bg-white font-medium', borderColorClass)
          : 'border-sidebar-foreground/20'
      )"
    >
      <RouterLink :to="item.href">
        <img
          v-if="item.iconPath"
          :src="item.iconPath"
          :alt="item.title"
          class="mr-2 h-4 w-4 shrink-0"
        />
        <component
          v-else-if="item.icon"
          :is="item.icon"
          class="mr-2 h-4 w-4 shrink-0"
        />
        <span>{{ item.title }}</span>
        <span
          v-if="item.badge"
          class="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full"
        >
          {{ item.badge }}
        </span>
      </RouterLink>
    </Button>
  </nav>
</template>
