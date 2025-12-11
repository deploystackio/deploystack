<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NavItem } from '.'

interface Props {
  items: NavItem[]
}

const props = defineProps<Props>()

const router = useRouter()

const isRouteActive = (url: string) => {
  const currentPath = router.currentRoute.value.path

  // Special case: '/teams' should only match exactly '/teams', not '/teams/manage/...'
  if (url === '/teams') {
    return currentPath === '/teams'
  }

  // For all other routes, use startsWith for sub-route matching
  return currentPath.startsWith(url)
}

const navigateTo = (url: string) => {
  router.push(url)
}
</script>

<template>
  <nav class="hidden md:flex items-center gap-1">
    <Button
      v-for="item in items"
      :key="item.url"
      variant="ghost"
      size="sm"
      @click="navigateTo(item.url)"
      :class="cn(
        'h-9 px-3 font-medium',
        isRouteActive(item.url)
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )"
    >
      {{ item.title }}
    </Button>
  </nav>
</template>
