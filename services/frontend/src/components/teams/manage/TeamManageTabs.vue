<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SettingsMenu, SettingsMenuGroup, SettingsMenuItem } from '@/components/ui/settings-menu'
import type { Team } from '@/services/teamService'

interface Props {
  team: Team
  teamId: string
}

const props = defineProps<Props>()
const route = useRoute()
const router = useRouter()

// Navigation menu items
const menuItems = computed(() => [
  { id: 'general', label: 'General', path: `/teams/manage/${props.teamId}/general` },
  { id: 'members', label: 'Members', path: `/teams/manage/${props.teamId}/members` },
  { id: 'usage', label: 'Usage', path: `/teams/manage/${props.teamId}/usage` }
])

// Map route names to section IDs
const routeToSectionMap: Record<string, string> = {
  'TeamManageGeneral': 'general',
  'TeamManageMembers': 'members',
  'TeamManageUsage': 'usage',
}

// Get current section from route name
const currentSection = computed(() => {
  const routeName = route.name as string
  return routeToSectionMap[routeName] || 'general'
})

// Navigate to a section (for mobile buttons)
function navigateToSection(sectionId: string) {
  const item = menuItems.value.find(item => item.id === sectionId)
  if (item) {
    router.push(item.path)
  }
}
</script>

<template>
  <div class="flex flex-col space-y-8 md:flex-row md:space-x-12 md:space-y-0">
    <!-- Desktop Sidebar Navigation -->
    <aside class="hidden md:block w-56 shrink-0">
      <SettingsMenu>
        <SettingsMenuGroup>
          <SettingsMenuItem
            v-for="item in menuItems"
            :key="item.id"
            :to="item.path"
            :active="currentSection === item.id"
          >
            {{ item.label }}
          </SettingsMenuItem>
        </SettingsMenuGroup>
      </SettingsMenu>
    </aside>

    <!-- Mobile Navigation -->
    <div class="block md:hidden">
      <nav class="flex space-x-1 p-1 bg-muted/50 rounded-lg">
        <button
          v-for="item in menuItems"
          :key="item.id"
          @click="navigateToSection(item.id)"
          class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors"
          :class="currentSection === item.id
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'"
        >
          {{ item.label }}
        </button>
      </nav>
    </div>

    <!-- Content Area Slot -->
    <div class="flex-1">
      <slot />
    </div>
  </div>
</template>
