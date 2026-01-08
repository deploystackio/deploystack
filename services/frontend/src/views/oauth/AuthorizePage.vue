<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, Shield } from 'lucide-vue-next'
import { OAuthService, type AuthorizeDetails } from '@/services/oauthService'
import { TeamService, type Team } from '@/services/teamService'

import {
  Card,
  CardContent,
} from '@/components/ui/card'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const loading = ref(true)
const error = ref<string | null>(null)
const authorizeDetails = ref<AuthorizeDetails | null>(null)
const teams = ref<Team[]>([])
const selectedTeamId = ref<string>('')
const processing = ref(false)
const action = ref<'approve' | 'deny' | null>(null)

// Error handling helper
const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    switch (err.message) {
      case 'UNAUTHORIZED':
        return t('oauth.authorize.errors.unauthorized')
      case 'REQUEST_NOT_FOUND':
        return t('oauth.authorize.errors.requestNotFound')
      case 'INVALID_REQUEST':
        return t('oauth.authorize.errors.invalidRequest')
      case 'ACCESS_DENIED':
        return t('oauth.authorize.errors.accessDenied')
      default:
        if (err.message.includes('fetch')) {
          return t('oauth.authorize.errors.networkError')
        }
        return t('oauth.authorize.errors.processingError')
    }
  }
  return t('oauth.authorize.errors.unknownError')
}

// Computed for scope translations
const scopesWithTranslations = computed(() => {
  if (!authorizeDetails.value?.scopes) return []

  return authorizeDetails.value.scopes.map(scope => {
    const translationKey = `oauth.authorize.scopes.${scope.name}`
    const hasTranslation = t(translationKey + '.name') !== translationKey + '.name'

    return {
      ...scope,
      displayName: hasTranslation ? t(translationKey + '.name') : scope.name,
      displayDescription: hasTranslation ? t(translationKey + '.description') : scope.description
    }
  })
})

// Load data on mount
onMounted(async () => {
  const requestId = route.query.request_id as string

  if (!requestId) {
    error.value = t('oauth.authorize.errors.missingRequestId')
    loading.value = false
    return
  }

  try {
    // Fetch authorization details and teams in parallel
    const [authDetails, userTeams] = await Promise.all([
      OAuthService.getAuthorizeDetails(requestId),
      TeamService.getUserTeams()
    ])

    authorizeDetails.value = authDetails
    teams.value = userTeams

    // Set default selected team
    const defaultTeam = userTeams.find(t => t.is_default) || userTeams[0]
    if (defaultTeam) {
      selectedTeamId.value = defaultTeam.id
    }
  } catch (err) {
    console.error('Failed to load authorization details:', err)
    error.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
})

// Handle authorization decision
const handleAuthorization = async (authAction: 'approve' | 'deny') => {
  if (!authorizeDetails.value || processing.value) return

  if (authAction === 'approve' && !selectedTeamId.value) {
    error.value = t('oauth.authorize.errors.noTeamSelected')
    return
  }

  processing.value = true
  action.value = authAction
  error.value = null

  try {
    const result = await OAuthService.submitAuthorization(
      authorizeDetails.value.request_id,
      selectedTeamId.value,
      authAction
    )

    if (result.success && result.redirect_url) {
      // Redirect to the MCP client callback URL
      window.location.href = result.redirect_url
    } else {
      throw new Error('Invalid response from server')
    }
  } catch (err) {
    console.error('Failed to process authorization:', err)
    error.value = getErrorMessage(err)
    processing.value = false
    action.value = null
  }
}

// Navigate back to dashboard
const returnToDashboard = () => {
  router.push('/mcp-server')
}
</script>

<template>
  <div class="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img
        class="mx-auto h-20 w-auto"
        src="/deploystack-logo-80x80.png"
        alt="DeployStack Logo"
      />
      <h2 class="mt-10 text-center text-2xl font-bold tracking-tight text-gray-900">
        {{ t('oauth.authorize.title') }}
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
      <!-- Error Alert -->
      <Alert v-if="error && !loading" variant="destructive" class="mb-6">
        <AlertTriangle class="h-4 w-4" />
        <AlertTitle>{{ t('oauth.authorize.errors.title') }}</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <Card>
        <CardContent class="pt-6">
          <!-- Loading State -->
          <div v-if="loading" class="text-center py-8">
            <Spinner class="mx-auto mb-4" />
            <p class="text-gray-600">{{ t('oauth.authorize.loading.message') }}</p>
          </div>

          <!-- Error State (no details loaded) -->
          <div v-else-if="!authorizeDetails" class="text-center py-4">
            <Button @click="returnToDashboard" variant="outline">
              {{ t('oauth.authorize.errors.returnToDashboard') }}
            </Button>
          </div>

          <!-- Authorization Form -->
          <div v-else class="space-y-6">
            <!-- Application Info -->
            <div class="text-center">
              <div class="mx-auto h-12 w-12 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                <Shield class="h-6 w-6 text-neutral-600" />
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">
                {{ t('oauth.authorize.subtitle') }}
              </h3>
            </div>

            <!-- User Info -->
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-sm text-gray-600 mb-1">{{ t('oauth.authorize.signedInAs') }}</p>
              <p class="font-medium text-gray-900">{{ authorizeDetails.user_email }}</p>
            </div>

            <!-- Permissions -->
            <div>
              <h4 class="text-sm font-medium text-gray-900 mb-2">
                {{ t('oauth.authorize.permissionsTitle') }}
              </h4>

              <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li v-for="scope in scopesWithTranslations" :key="scope.name">
                  {{ scope.displayDescription }}
                </li>
              </ul>
            </div>

            <!-- Team Selection -->
            <div>
              <label class="text-sm font-medium text-gray-900 mb-2 block">
                {{ t('oauth.authorize.teamSelection.label') }}
              </label>
              <Select v-model="selectedTeamId">
                <SelectTrigger class="w-full">
                  <SelectValue :placeholder="t('oauth.authorize.teamSelection.placeholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="team in teams"
                    :key="team.id"
                    :value="team.id"
                  >
                    {{ team.name }}{{ team.is_default ? ` (${t('oauth.authorize.teamSelection.default')})` : '' }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-sm text-gray-500 mt-2">
                {{ t('oauth.authorize.teamSelection.helpText') }}
              </p>
            </div>

            <!-- Actions -->
            <div class="space-y-3 pt-4">
              <Button
                @click="handleAuthorization('approve')"
                :disabled="processing || !selectedTeamId"
                class="w-full"
                size="lg"
              >
                <Spinner v-if="processing && action === 'approve'" class="mr-2" />
                <span v-if="processing && action === 'approve'">
                  {{ t('oauth.authorize.buttons.authorizing') }}
                </span>
                <span v-else>
                  {{ t('oauth.authorize.buttons.authorize') }}
                </span>
              </Button>

              <Button
                @click="handleAuthorization('deny')"
                :disabled="processing"
                variant="outline"
                class="w-full"
                size="lg"
              >
                <Spinner v-if="processing && action === 'deny'" class="mr-2" />
                <span v-if="processing && action === 'deny'">
                  {{ t('oauth.authorize.buttons.denying') }}
                </span>
                <span v-else>
                  {{ t('oauth.authorize.buttons.deny') }}
                </span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
