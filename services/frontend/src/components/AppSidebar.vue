<script setup lang="ts">
import { ref, onMounted, defineProps, computed } from 'vue' // Added defineProps
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getEnv } from '@/utils/env' // Import getEnv
// import { cn } from '@/lib/utils' // cn might not be needed for root if $attrs.class is used directly
// import { ScrollArea } from '@/components/ui/scroll-area' // SidebarContent should handle scrolling

// Re-add Sidebar specific imports
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  type SidebarProps, // Import SidebarProps type if available for variant
} from '@/components/ui/sidebar'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TeamService, type Team } from '@/services/teamService'
import { UserService, type User } from '@/services/userService'
import {
  Server,
  Settings,
  Key,
  ChevronDown,
  User as UserIcon,
  LogOut,
  Users,
  FileSliders
} from 'lucide-vue-next'

// Define props, including variant
interface Props {
  variant?: SidebarProps['variant'] // Use type from SidebarProps if possible, else string
  // collapsible?: SidebarProps['collapsible']
}
const props = defineProps<Props>()

const router = useRouter()
const { t } = useI18n()

// User data
const currentUser = ref<User | null>(null)
const userEmail = ref('')
const userName = ref('')
const userLoading = ref(true)

// Role checking
const isGlobalAdmin = computed(() => {
  return currentUser.value?.role_id === 'global_admin'
})

// Teams data
const teams = ref<Team[]>([])
const selectedTeam = ref<Team | null>(null)
const teamsLoading = ref(true)
const teamsError = ref('')

// Navigation items
const navigationItems = [
  {
    title: t('sidebar.navigation.mcpServer'),
    icon: Server,
    url: '/mcp-server',
  },
  {
    title: t('sidebar.navigation.provider'),
    icon: Settings,
    url: '/provider',
  },
  {
    title: t('sidebar.navigation.credentials'),
    icon: Key,
    url: '/credentials',
  },
]

// Fetch user data logic using UserService
const fetchUserData = async () => {
  try {
    const user = await UserService.getCurrentUser()
    if (user) {
      currentUser.value = user
      userEmail.value = user.email
      userName.value = user.username || ''
    } else {
      // User not logged in, redirect to login
      router.push('/login')
    }
  } catch (error) {
    console.error('Error fetching user data:', error)
    currentUser.value = null
  } finally {
    userLoading.value = false
  }
}

// Fetch teams logic (remains the same)
const fetchTeams = async () => {
  try {
    teamsLoading.value = true; teamsError.value = '';
    const userTeams = await TeamService.getUserTeams(); teams.value = userTeams;
    if (userTeams.length > 0) { selectedTeam.value = userTeams[0]; }
  } catch (error) { console.error('Error fetching teams:', error); teamsError.value = error instanceof Error ? error.message : 'Failed to load teams'; } finally { teamsLoading.value = false; }
}

const selectTeam = (team: Team) => { selectedTeam.value = team }
const navigateTo = (url: string) => { router.push(url) }
const goToAccount = () => { router.push('/user/account') }
const logout = () => { router.push('/logout') }
const getUserInitials = (name: string) => { return name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().slice(0, 2) }

onMounted(() => {
  fetchUserData()
  fetchTeams()
})
</script>

<template>
  <Sidebar :variant="props.variant" :class="$attrs.class" collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Users class="size-4" />
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">
                    {{ selectedTeam?.name || t('sidebar.teams.selectTeam') }}
                  </span>
                  <span class="truncate text-xs text-sidebar-foreground/70">
                    {{ teamsLoading ? t('sidebar.teams.loading') : teams.length > 0 ? `${teams.length} team${teams.length !== 1 ? 's' : ''}` : t('sidebar.teams.noTeams') }}
                  </span>
                </div>
                <ChevronDown class="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              side="bottom"
              align="start"
            >
              <div v-if="teamsLoading" class="p-2 text-sm text-muted-foreground">
                {{ t('sidebar.teams.loading') }}
              </div>
              <div v-else-if="teamsError" class="p-2 text-sm text-destructive">
                {{ teamsError }}
              </div>
              <div v-else-if="teams.length === 0" class="p-2 text-sm text-muted-foreground">
                {{ t('sidebar.teams.noTeams') }}
              </div>
              <template v-else>
                <DropdownMenuItem
                  v-for="team_item in teams"
                  :key="team_item.id"
                  @click="selectTeam(team_item)"
                  class="gap-2 p-2"
                >
                  <div class="flex size-6 items-center justify-center rounded-sm border shrink-0">
                    <Users class="size-4" />
                  </div>
                  <div class="flex flex-col">
                    <span class="font-medium">{{ team_item.name }}</span>
                    <span v-if="team_item.description" class="text-xs text-muted-foreground">
                      {{ team_item.description }}
                    </span>
                  </div>
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>{{ t('sidebar.navigation.title', 'Navigation') }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in navigationItems" :key="item.title">
              <SidebarMenuButton
                @click="navigateTo(item.url)"
                :is-active="router.currentRoute.value.path === item.url"
                class="w-full justify-start"
                :aria-current="router.currentRoute.value.path === item.url ? 'page' : undefined"
              >
                <component :is="item.icon" class="mr-2 h-4 w-4 shrink-0" />
                <span>{{ item.title }}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <!-- Admin Area section - only visible to global_admin -->
      <SidebarGroup v-if="isGlobalAdmin">
        <SidebarGroupLabel>{{ t('sidebar.adminArea.title') }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                @click="navigateTo('/global-settings')"
                :is-active="router.currentRoute.value.path === '/global-settings'"
                class="w-full justify-start"
                :aria-current="router.currentRoute.value.path === '/global-settings' ? 'page' : undefined"
              >
                <FileSliders class="mr-2 h-4 w-4 shrink-0" />
                <span>{{ t('sidebar.adminArea.globalSettings') }}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <Avatar class="h-8 w-8 rounded-lg">
                  <AvatarImage src="https://www.shadcn-vue.com/avatars/shadcn.jpg" :alt="userName" />
                  <AvatarFallback class="rounded-lg">
                    {{ userLoading ? '...' : getUserInitials(userName || userEmail) }}
                  </AvatarFallback>
                </Avatar>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">{{ userName || userEmail }}</span>
                  <span class="truncate text-xs text-sidebar-foreground/70">{{ userEmail }}</span>
                </div>
                <ChevronDown class="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              side="top"
              align="start"
            >
              <DropdownMenuItem @click="goToAccount" class="gap-2">
                <UserIcon class="size-4" />
                {{ t('sidebar.user.account') }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="logout" class="gap-2">
                <LogOut class="size-4" />
                {{ t('sidebar.user.logout') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  </Sidebar>
</template>
