<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw } from 'lucide-vue-next'
import NavbarLayout from '@/components/NavbarLayout.vue'
import TeamEditForm from '@/components/admin/teams/TeamEditForm.vue'
import { TeamService } from '@/services/teamService'
import type { Team, UpdateTeamAdminRequest } from '../types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const team = ref<Team | null>(null)
const isLoading = ref(true)
const isSubmitting = ref(false)
const error = ref<string | null>(null)

const teamId = route.params.id as string

// Fetch team details
const fetchTeam = async () => {
  try {
    isLoading.value = true
    error.value = null
    team.value = await TeamService.getTeamAsAdmin(teamId)

    // Update breadcrumbs with team name
    setBreadcrumbs([
      { label: t('adminTeams.title'), href: '/admin/teams' },
      { label: team.value.name, href: `/admin/teams/${teamId}` },
      { label: t('adminTeams.teamEdit.editButton') }
    ])
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    team.value = null
  } finally {
    isLoading.value = false
  }
}

// Handle form submission
const handleSubmit = async (updates: UpdateTeamAdminRequest) => {
  if (!team.value) return

  try {
    isSubmitting.value = true
    await TeamService.updateTeamAsAdmin(teamId, updates)

    toast.success(t('adminTeams.teamEdit.success'))

    // Navigate back to team detail page
    router.push(`/admin/teams/${teamId}`)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
    toast.error(t('adminTeams.teamEdit.error', { error: errorMessage }))
  } finally {
    isSubmitting.value = false
  }
}

// Handle form cancellation
const handleCancel = () => {
  router.push(`/admin/teams/${teamId}`)
}

// Retry loading
const retryLoad = () => {
  fetchTeam()
}

onMounted(() => {
  setBreadcrumbs([
    { label: t('adminTeams.title'), href: '/admin/teams' },
    { label: t('adminTeams.teamEdit.titleLoading') }
  ])
  fetchTeam()
})
</script>

<template>
  <NavbarLayout>
    <div class="space-y-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="text-center space-y-4">
          <RefreshCw class="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p class="text-muted-foreground">{{ t('adminTeams.teamEdit.loading') }}</p>
        </div>
      </div>

      <!-- Error State -->
      <Card v-else-if="error" class="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle class="text-red-900">{{ t('adminTeams.teamEdit.errorLoading', { error }) }}</CardTitle>
          <CardDescription class="text-red-700">
            Please try again or contact support if the problem persists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button @click="retryLoad" variant="outline">
            <RefreshCw class="h-4 w-4 mr-2" />
            {{ t('adminTeams.teamEdit.retryButton') }}
          </Button>
        </CardContent>
      </Card>

      <!-- Edit Form -->
      <Card v-else-if="team">
        <CardHeader>
          <CardTitle>{{ t('adminTeams.teamEdit.title', { name: team.name }) }}</CardTitle>
          <CardDescription>
            Update team information and configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamEditForm
            :team="team"
            :is-submitting="isSubmitting"
            @submit="handleSubmit"
            @cancel="handleCancel"
          />
        </CardContent>
      </Card>
    </div>
  </NavbarLayout>
</template>
