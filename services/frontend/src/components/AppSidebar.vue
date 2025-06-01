<script setup lang="ts">
import { ref, onMounted, defineProps } from 'vue' // Added defineProps
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
import { Button } from '@/components/ui/button' // Still used for DropdownMenuTrigger as-child
import { TeamService, type Team } from '@/services/teamService'
import {
  Server,
  Settings,
  Key,
  ChevronDown,
  User,
  LogOut,
  Users
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
const userEmail = ref('')
const userName = ref('')
const userLoading = ref(true)

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

// Fetch user data logic (remains the same)
const fetchUserData = async () => {
  try {
    const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') // Use getEnv with the correct key
    if (!apiUrl) {
      throw new Error('API URL not configured. Make sure VITE_DEPLOYSTACK_BACKEND_URL is set.')
    }
    const response = await fetch(`${apiUrl}/api/users/me`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
    if (!response.ok) {
      if (response.status === 401) { router.push('/login'); return }
      throw new Error(`Failed to fetch user data: ${response.status}`)
    }
    const data = await response.json()
    if (data.success && data.data) { userEmail.value = data.data.email; userName.value = data.data.username; }
  } catch (error) { console.error('Error fetching user data:', error) } finally { userLoading.value = false }
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
              <!-- Using Button for consistency with shadcn-vue SidebarMenuButton structure -->
              <Button variant="ghost" size="lg" class="w-full justify-start items-center data-[state=open]:bg-accent data-[state=open]:text-accent-foreground px-2 h-auto py-2.5">
                <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground mr-2 shrink-0">
                  <Users class="size-4" />
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">
                    {{ selectedTeam?.name || t('sidebar.teams.selectTeam') }}
                  </span>
                  <span class="truncate text-xs text-muted-foreground">
                    {{ teamsLoading ? t('sidebar.teams.loading') : teams.length > 0 ? `${teams.length} team${teams.length !== 1 ? 's' : ''}` : t('sidebar.teams.noTeams') }}
                  </span>
                </div>
                <ChevronDown class="ml-2 size-4 text-muted-foreground shrink-0" />
              </Button>
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
    </SidebarContent>

    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <!-- Using Button for consistency -->
              <Button variant="ghost" size="lg" class="w-full justify-start items-center data-[state=open]:bg-accent data-[state=open]:text-accent-foreground px-2 h-auto py-2.5">
                <Avatar class="h-8 w-8 rounded-lg mr-2 shrink-0">
                  <AvatarImage src="https://www.shadcn-vue.com/avatars/shadcn.jpg" :alt="userName" />
                  <AvatarFallback class="rounded-lg">
                    {{ userLoading ? '...' : getUserInitials(userName || userEmail) }}
                  </AvatarFallback>
                </Avatar>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">{{ userName || userEmail }}</span>
                  <span class="truncate text-xs text-muted-foreground">{{ userEmail }}</span>
                </div>
                <ChevronDown class="ml-2 size-4 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              side="top"
              align="start"
            >
              <DropdownMenuItem @click="goToAccount" class="gap-2">
                <User class="size-4" />
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
