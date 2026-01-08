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
import { FeedbackModal } from '@/components/feedback'

import {
  LayoutDashboard,
  Server,
  Bot,
  BarChart3
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

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

// Feedback modal state
const showFeedbackModal = ref(false)

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

// Button visibility based on user display settings
const showDiscordButton = computed(() => {
  return currentUser.value?.user_display_settings?.header_show_discord === true
})

const showFeedbackButton = computed(() => {
  return currentUser.value?.user_display_settings?.header_show_feedback === true
})

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

const openDiscord = () => {
  window.open('https://discord.gg/42Ce3S7b3b', '_blank', 'noopener,noreferrer')
}

const openFeedbackModal = () => {
  showFeedbackModal.value = true
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
      <div class="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
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

        <!-- Right: Discord + Feedback + User Menu + Mobile Toggle -->
        <div class="flex items-center gap-2">
          <!-- Discord Button -->
          <Button
            v-if="showDiscordButton"
            variant="outline"
            size="icon"
            class="h-9 w-9"
            @click="openDiscord"
            title="Join our Discord community"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" class="shrink-0">
              <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612"/>
            </svg>
          </Button>

          <!-- Feedback Button -->
          <Button
            v-if="showFeedbackButton"
            variant="outline"
            @click="openFeedbackModal"
            title="Send feedback"
          >
            Feedback
          </Button>

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
      <div class="flex h-12 items-center gap-1 px-4 sm:px-6 lg:px-8">
        <DsNavbarLinks :items="navigationItems" />
        <DsNavbarTeamsMenu />
        <DsNavbarAdminMenu :is-visible="isGlobalAdmin" />
      </div>
    </div>
  </header>

  <!-- Feedback Modal -->
  <FeedbackModal v-model:open="showFeedbackModal" />
</template>
