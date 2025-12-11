<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { HTMLAttributes } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { cn } from '@/lib/utils'
import { navbarVariants, type NavbarVariants, type NavItem } from '.'
import { TeamService, type Team } from '@/services/teamService'
import { UserService, type User } from '@/services/userService'
import { useEventBus } from '@/composables/useEventBus'

import DsNavbarBrand from './DsNavbarBrand.vue'
import DsNavbarLinks from './DsNavbarLinks.vue'
import DsNavbarTeamsMenu from './DsNavbarTeamsMenu.vue'
import DsNavbarAdminMenu from './DsNavbarAdminMenu.vue'
import DsNavbarUserMenu from './DsNavbarUserMenu.vue'
import DsNavbarMobileMenu from './DsNavbarMobileMenu.vue'

import {
  LayoutDashboard,
  Server,
  Bot,
  BarChart3
} from 'lucide-vue-next'

interface Props {
  variant?: NavbarVariants['variant']
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})

const router = useRouter()
const { t } = useI18n()
const eventBus = useEventBus()

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
const navigationItems = computed<NavItem[]>(() => [
  {
    title: t('sidebar.navigation.dashboard'),
    icon: LayoutDashboard,
    url: '/dashboard',
  },
  {
    title: t('sidebar.navigation.mcpServer'),
    icon: Server,
    url: '/mcp-server',
  },
  {
    title: t('sidebar.navigation.clientConfiguration'),
    icon: Bot,
    url: '/client-configuration',
  },
  {
    title: t('sidebar.navigation.statistics'),
    icon: BarChart3,
    url: '/statistics',
  },
])

// Fetch user data logic using UserService
const fetchUserData = async (forceRefresh = false) => {
  try {
    const user = await UserService.getCurrentUser(forceRefresh)
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

// Fetch teams logic with smart caching
const fetchTeams = async (forceRefresh = false) => {
  try {
    teamsLoading.value = true
    teamsError.value = ''
    const userTeams = await TeamService.getUserTeams(forceRefresh)
    teams.value = userTeams

    // Initialize selected team from storage or fallback to default
    if (userTeams.length > 0) {
      const storedTeamId = eventBus.getState<string>('selected_team_id')

      if (storedTeamId) {
        // Try to find the stored team in available teams
        const storedTeam = userTeams.find(team => team.id === storedTeamId)
        if (storedTeam) {
          selectedTeam.value = storedTeam
        } else {
          // Stored team not found, fallback to default team
          const defaultTeam = userTeams.find(team => team.is_default) || userTeams[0]
          if (defaultTeam) {
            selectedTeam.value = defaultTeam
            eventBus.setState('selected_team_id', defaultTeam.id)
          }
        }
      } else {
        // No stored team, use default team
        const defaultTeam = userTeams.find(team => team.is_default) || userTeams[0]
        if (defaultTeam) {
          selectedTeam.value = defaultTeam
          eventBus.setState('selected_team_id', defaultTeam.id)
        }
      }
    }
  } catch (error) {
    console.error('Error fetching teams:', error)
    teamsError.value = error instanceof Error ? error.message : 'Failed to load teams'
  } finally {
    teamsLoading.value = false
  }
}

// Event handlers
const selectTeam = (team: Team) => {
  selectedTeam.value = team
  // Store team selection in persistent storage
  eventBus.setState('selected_team_id', team.id)
  // Emit global event for team selection
  eventBus.emit('team-selected', { teamId: team.id, teamName: team.name })
}

const navigateTo = (url: string) => {
  router.push(url)
}

const goToAccount = () => {
  router.push('/user/account')
}

const logout = async () => {
  try {
    // Clear user cache and logout
    await UserService.logout()
    router.push('/login')
  } catch (error) {
    console.error('Error during logout:', error)
    // Still redirect to logout page to handle any cleanup
    router.push('/logout')
  }
}

// Handle team selection from other components
const handleTeamSelectedFromOtherComponents = (data: { teamId: string; teamName: string }) => {
  const team = teams.value.find(t => t.id === data.teamId)
  if (team) {
    selectedTeam.value = team
  }
}

onMounted(() => {
  fetchUserData()
  fetchTeams()

  // Listen for team updates from other components
  eventBus.on('teams-updated', () => {
    fetchTeams(true)
  })

  // Listen for team selection from other components
  eventBus.on('team-selected', handleTeamSelectedFromOtherComponents)
})

onUnmounted(() => {
  // Clean up event listeners
  eventBus.off('teams-updated')
  eventBus.off('team-selected', handleTeamSelectedFromOtherComponents)
})
</script>

<template>
  <header
    data-slot="navbar"
    :class="cn(navbarVariants({ variant }), props.class)"
  >
    <!-- Row 1: Brand + Team Selector + User Menu -->
    <div>
      <div class="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <!-- Left: Brand + Team Selector -->
        <div class="flex items-center gap-4">
          <DsNavbarBrand
            :teams="teams"
            :selected-team="selectedTeam"
            :teams-loading="teamsLoading"
            :teams-error="teamsError"
            @select-team="selectTeam"
          />
        </div>

        <!-- Right: User Menu + Mobile Toggle -->
        <div class="flex items-center gap-2">
          <DsNavbarUserMenu
            :user-name="userName"
            :user-email="userEmail"
            :user-loading="userLoading"
            class="hidden md:flex"
            @go-to-account="goToAccount"
            @logout="logout"
          />

          <!-- Mobile Menu -->
          <DsNavbarMobileMenu
            :navigation-items="navigationItems"
            :is-global-admin="isGlobalAdmin"
            :teams="teams"
            :selected-team="selectedTeam"
            :user-name="userName"
            :user-email="userEmail"
            @navigate="navigateTo"
            @select-team="selectTeam"
            @go-to-account="goToAccount"
            @logout="logout"
          />
        </div>
      </div>
    </div>

    <!-- Row 2: Navigation Links -->
    <div class="hidden md:block">
      <div class="mx-auto flex h-12 max-w-[1200px] items-center gap-1 px-4 sm:px-6 lg:px-8">
        <DsNavbarLinks :items="navigationItems" />
        <DsNavbarTeamsMenu />
        <DsNavbarAdminMenu :is-visible="isGlobalAdmin" />
      </div>
    </div>
  </header>
</template>
