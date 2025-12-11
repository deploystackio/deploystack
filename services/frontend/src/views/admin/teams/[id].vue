<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { SettingsMenu, SettingsMenuGroup, SettingsMenuItem } from '@/components/ui/settings-menu'
import { Pencil } from 'lucide-vue-next'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { TeamService } from '@/services/teamService'
import TeamDetailGeneral from '@/components/admin/teams/TeamDetailGeneral.vue'
import TeamDetailLimits from '@/components/admin/teams/TeamDetailLimits.vue'
import TeamDetailMembers from '@/components/admin/teams/TeamDetailMembers.vue'
import type { Team } from './types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const team = ref<Team | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const teamId = route.params.id as string

// Current section from query params (default to 'general')
const currentSection = computed(() => {
  const section = route.query.section as string
  if (section === 'limits') return 'limits'
  if (section === 'members') return 'members'
  return 'general'
})

// Navigation menu items
const menuItems = [
  { id: 'general', label: 'General' },
  { id: 'limits', label: 'Limits' },
  { id: 'members', label: 'Members' }
]

// Navigate to a section
function navigateToSection(sectionId: string) {
  router.push({
    path: route.path,
    query: { section: sectionId }
  })
}

// Fetch team details from API using admin endpoint
async function fetchTeam(id: string): Promise<Team> {
  return await TeamService.getTeamAsAdmin(id)
}

// Load team on component mount
onMounted(async () => {
  setBreadcrumbs([
    { label: t('adminTeams.title'), href: '/admin/teams' },
    { label: t('adminTeams.teamDetail.titleLoading') }
  ])

  try {
    isLoading.value = true
    team.value = await fetchTeam(teamId)
    error.value = null

    // Update breadcrumbs with team name
    setBreadcrumbs([
      { label: t('adminTeams.title'), href: '/admin/teams' },
      { label: team.value.name }
    ])
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    team.value = null
  } finally {
    isLoading.value = false
  }
})

const goToEdit = () => {
  router.push(`/admin/teams/edit/${teamId}`)
}
</script>

<template>
  <NavbarLayout>
    <!-- Header with breadcrumbs and actions -->
    <DsPageHeading v-if="team" :title="team.name">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/teams">
              {{ t('adminTeams.title') }}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{{ team.name }}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <template #actions>
        <Button
          variant="outline"
          @click="goToEdit"
        >
          <Pencil class="h-4 w-4 mr-2" />
          {{ t('adminTeams.teamDetail.actions.edit') }}
        </Button>
      </template>
    </DsPageHeading>

    <DsPageHeading v-else-if="isLoading" :title="t('adminTeams.teamDetail.titleLoading')" />

    <div class="space-y-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('adminTeams.teamDetail.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('adminTeams.teamDetail.errorLoading', { error }) }}
      </div>

      <!-- Team Details with Settings Menu Layout -->
      <div v-else-if="team" class="flex flex-col space-y-8 md:flex-row md:space-x-12 md:space-y-0">
        <!-- Desktop Sidebar Navigation -->
        <aside class="hidden md:block w-56 shrink-0">
          <SettingsMenu>
            <SettingsMenuGroup>
              <SettingsMenuItem
                v-for="item in menuItems"
                :key="item.id"
                :to="`/admin/teams/${teamId}?section=${item.id}`"
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

        <!-- Content Area -->
        <div class="flex-1">
          <TeamDetailGeneral v-if="currentSection === 'general'" :team="team" />
          <TeamDetailLimits v-else-if="currentSection === 'limits'" :team="team" />
          <TeamDetailMembers v-else-if="currentSection === 'members'" :team-id="teamId" />
        </div>
      </div>
    </div>
  </NavbarLayout>
</template>
