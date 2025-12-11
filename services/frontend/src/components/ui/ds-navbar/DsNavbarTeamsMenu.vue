<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Users, UserRoundPen, ChevronDown } from 'lucide-vue-next'
import type { NavItem } from '.'

const router = useRouter()
const { t } = useI18n()

const teamItems: NavItem[] = [
  {
    title: t('sidebar.teams.myTeams'),
    icon: Users,
    url: '/teams',
  },
  {
    title: t('sidebar.teams.manageTeam'),
    icon: UserRoundPen,
    url: '/teams/manage',
  },
]

const isRouteActive = (url: string) => {
  const currentPath = router.currentRoute.value.path

  if (url === '/teams') {
    return currentPath === '/teams'
  }

  return currentPath.startsWith(url)
}

const isTeamsActive = () => {
  return teamItems.some(item => isRouteActive(item.url))
}

const navigateTo = (url: string) => {
  router.push(url)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        :class="cn(
          'hidden md:inline-flex h-9 px-3 font-medium gap-1',
          isTeamsActive()
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )"
      >
        <span>{{ t('sidebar.teams.title') }}</span>
        <ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-48">
      <DropdownMenuItem
        v-for="item in teamItems"
        :key="item.url"
        @click="navigateTo(item.url)"
        :class="cn(
          'gap-2 cursor-pointer',
          isRouteActive(item.url) && 'bg-accent'
        )"
      >
        <component :is="item.icon" class="h-4 w-4 shrink-0" />
        <span>{{ item.title }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
