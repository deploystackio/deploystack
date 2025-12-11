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
import {
  FileSliders,
  Users,
  Server,
  FolderTree,
  Satellite,
  ListTodo,
  ChevronDown
} from 'lucide-vue-next'
import type { NavItem } from '.'

interface Props {
  isVisible: boolean
}

const props = defineProps<Props>()

const router = useRouter()
const { t } = useI18n()

const adminItems: NavItem[] = [
  {
    title: t('sidebar.adminArea.globalSettings'),
    icon: FileSliders,
    url: '/admin/settings',
  },
  {
    title: t('sidebar.adminArea.users'),
    icon: Users,
    url: '/admin/users',
  },
  {
    title: t('sidebar.adminArea.teams'),
    icon: Users,
    url: '/admin/teams',
  },
  {
    title: t('sidebar.adminArea.mcpCatalog'),
    icon: Server,
    url: '/admin/mcp-server-catalog',
  },
  {
    title: t('sidebar.adminArea.mcpCategories'),
    icon: FolderTree,
    url: '/admin/mcp-categories',
  },
  {
    title: t('sidebar.adminArea.satellites'),
    icon: Satellite,
    url: '/admin/satellites',
  },
  {
    title: t('sidebar.adminArea.backgroundJobs'),
    icon: ListTodo,
    url: '/admin/jobs',
  },
]

const isRouteActive = (url: string) => {
  const currentPath = router.currentRoute.value.path
  return currentPath.startsWith(url)
}

const isAdminActive = () => {
  return adminItems.some(item => isRouteActive(item.url))
}

const navigateTo = (url: string) => {
  router.push(url)
}
</script>

<template>
  <DropdownMenu v-if="isVisible">
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        :class="cn(
          'hidden md:inline-flex h-9 px-3 font-medium gap-1',
          isAdminActive()
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )"
      >
        <span>{{ t('sidebar.adminArea.title') }}</span>
        <ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-56">
      <DropdownMenuItem
        v-for="item in adminItems"
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
