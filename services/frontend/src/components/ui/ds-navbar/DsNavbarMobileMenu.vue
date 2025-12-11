<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  Menu,
  Users,
  UserRoundPen,
  FileSliders,
  Server,
  FolderTree,
  Satellite,
  ListTodo,
  User as UserIcon,
  LogOut,
  Check,
  Shield
} from 'lucide-vue-next'
import type { Team } from '@/services/teamService'
import type { NavItem } from '.'

interface Props {
  navigationItems: NavItem[]
  isGlobalAdmin: boolean
  teams: Team[]
  selectedTeam: Team | null
  userName: string
  userEmail: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'navigate', url: string): void
  (e: 'select-team', team: Team): void
  (e: 'go-to-account'): void
  (e: 'logout'): void
}>()

const router = useRouter()
const { t } = useI18n()
const isOpen = ref(false)

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

  if (url === '/teams') {
    return currentPath === '/teams'
  }

  return currentPath.startsWith(url)
}

const handleNavigate = (url: string) => {
  emit('navigate', url)
  isOpen.value = false
}

const handleSelectTeam = (team: Team) => {
  emit('select-team', team)
}

const handleGoToAccount = () => {
  emit('go-to-account')
  isOpen.value = false
}

const handleLogout = () => {
  emit('logout')
  isOpen.value = false
}

const getUserInitials = (name: string) => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="md:hidden"
      >
        <Menu class="h-5 w-5" />
        <span class="sr-only">Open menu</span>
      </Button>
    </SheetTrigger>
    <SheetContent side="left" class="w-80 p-0">
      <SheetHeader class="p-4 border-b">
        <SheetTitle>{{ t('sidebar.navigation.title') }}</SheetTitle>
      </SheetHeader>

      <div class="flex flex-col h-full overflow-y-auto">
        <!-- Team Selection -->
        <div class="p-4 border-b">
          <p class="text-xs font-medium text-muted-foreground mb-2">
            {{ t('sidebar.teams.title') }}
          </p>
          <div class="space-y-1">
            <button
              v-for="team in teams"
              :key="team.id"
              @click="handleSelectTeam(team)"
              :class="cn(
                'w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                selectedTeam?.id === team.id
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )"
            >
              <div class="flex size-6 items-center justify-center rounded-sm border shrink-0">
                <Users class="size-3" />
              </div>
              <span class="flex-1 text-left truncate">{{ team.name }}</span>
              <Check
                v-if="selectedTeam?.id === team.id"
                class="h-4 w-4 shrink-0"
              />
            </button>
          </div>
        </div>

        <!-- Navigation Items -->
        <div class="p-4 border-b">
          <p class="text-xs font-medium text-muted-foreground mb-2">
            {{ t('sidebar.navigation.title') }}
          </p>
          <div class="space-y-1">
            <button
              v-for="item in navigationItems"
              :key="item.url"
              @click="handleNavigate(item.url)"
              :class="cn(
                'w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isRouteActive(item.url)
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )"
            >
              <component :is="item.icon" class="h-4 w-4 shrink-0" />
              <span>{{ item.title }}</span>
            </button>
          </div>
        </div>

        <!-- Team Menu Items -->
        <div class="p-4 border-b">
          <p class="text-xs font-medium text-muted-foreground mb-2">
            {{ t('sidebar.teams.title') }}
          </p>
          <div class="space-y-1">
            <button
              v-for="item in teamItems"
              :key="item.url"
              @click="handleNavigate(item.url)"
              :class="cn(
                'w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isRouteActive(item.url)
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )"
            >
              <component :is="item.icon" class="h-4 w-4 shrink-0" />
              <span>{{ item.title }}</span>
            </button>
          </div>
        </div>

        <!-- Admin Items (conditional) -->
        <div v-if="isGlobalAdmin" class="p-4 border-b">
          <p class="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Shield class="h-3 w-3" />
            {{ t('sidebar.adminArea.title') }}
          </p>
          <div class="space-y-1">
            <button
              v-for="item in adminItems"
              :key="item.url"
              @click="handleNavigate(item.url)"
              :class="cn(
                'w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isRouteActive(item.url)
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )"
            >
              <component :is="item.icon" class="h-4 w-4 shrink-0" />
              <span>{{ item.title }}</span>
            </button>
          </div>
        </div>

        <!-- User Section (at bottom) -->
        <div class="mt-auto p-4 border-t">
          <div class="flex items-center gap-3 mb-3">
            <Avatar class="h-10 w-10">
              <AvatarImage src="/images/user.jpg" :alt="userName" />
              <AvatarFallback>
                {{ getUserInitials(userName || userEmail) }}
              </AvatarFallback>
            </Avatar>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{{ userName || userEmail }}</p>
              <p v-if="userName" class="text-xs text-muted-foreground truncate">{{ userEmail }}</p>
            </div>
          </div>
          <div class="space-y-1">
            <button
              @click="handleGoToAccount"
              class="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
            >
              <UserIcon class="h-4 w-4 shrink-0" />
              <span>{{ t('sidebar.user.account') }}</span>
            </button>
            <button
              @click="handleLogout"
              class="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut class="h-4 w-4 shrink-0" />
              <span>{{ t('sidebar.user.logout') }}</span>
            </button>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
