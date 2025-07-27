<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CheckCircle, AlertTriangle, Shield } from 'lucide-vue-next'
import { OAuthService, type ConsentDetails } from '@/services/oauthService'

import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'

import { Button } from '@/components/ui/button'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const loading = ref(true)
const error = ref<string | null>(null)
const consentDetails = ref<ConsentDetails | null>(null)
const processing = ref(false)
const action = ref<'approve' | 'deny' | null>(null)

// Computed properties for better UX
const pageTitle = computed(() => {
  if (loading.value) return t('oauth.consent.loading.title')
  if (error.value) return t('oauth.consent.errors.title')
  return t('oauth.consent.title')
})

const clientName = computed(() => {
  return consentDetails.value?.client_name || 'Unknown Application'
})

const scopesWithTranslations = computed(() => {
  if (!consentDetails.value?.scopes) return []

  return consentDetails.value.scopes.map(scope => {
    const translationKey = `oauth.consent.scopes.${scope.name}`
    const hasTranslation = t(translationKey + '.name') !== translationKey + '.name'

    return {
      ...scope,
      displayName: hasTranslation ? t(translationKey + '.name') : scope.name,
      displayDescription: hasTranslation ? t(translationKey + '.description') : scope.description
    }
  })
})

// Error handling helper
const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    switch (err.message) {
      case 'UNAUTHORIZED':
        return t('oauth.consent.errors.unauthorized')
      case 'REQUEST_NOT_FOUND':
        return t('oauth.consent.errors.requestNotFound')
      case 'INVALID_REQUEST':
        return t('oauth.consent.errors.invalidRequest')
      default:
        if (err.message.includes('fetch')) {
          return t('oauth.consent.errors.networkError')
        }
        return t('oauth.consent.errors.processingError')
    }
  }
  return t('oauth.consent.errors.unknownError')
}

// Load consent details on mount
onMounted(async () => {
  const requestId = route.query.request_id as string

  if (!requestId) {
    error.value = t('oauth.consent.errors.missingRequestId')
    loading.value = false
    return
  }

  try {
    consentDetails.value = await OAuthService.getConsentDetails(requestId)
  } catch (err) {
    console.error('Failed to load consent details:', err)
    error.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
})

// Handle consent decision
const handleConsent = async (consentAction: 'approve' | 'deny') => {
  if (!consentDetails.value || processing.value) return

  processing.value = true
  action.value = consentAction

  try {
    const result = await OAuthService.submitConsentDecision(
      consentDetails.value.request_id,
      consentAction
    )

    if (result.success && result.redirect_url) {
      // Redirect to the CLI callback URL
      window.location.href = result.redirect_url
    } else {
      throw new Error('Invalid response from server')
    }
  } catch (err) {
    console.error('Failed to process consent:', err)
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
  <div class="bg-gray-50 min-h-screen flex items-center justify-center px-4 py-12">
    <div class="max-w-md w-full">
      <!-- Page Header -->
      <div class="text-center mb-8">
        <img
          class="mx-auto h-16 w-auto mb-6"
          src="/deploystack-logo-74x80.webp"
          alt="DeployStack Logo"
        />
        <h1 class="text-2xl font-bold text-gray-900">
          {{ pageTitle }}
        </h1>
      </div>

      <Card>
        <CardContent class="pt-6">
          <!-- Loading State -->
          <div v-if="loading" class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p class="text-gray-600">{{ t('oauth.consent.loading.message') }}</p>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="text-center py-4">
            <Alert variant="destructive" class="mb-6">
              <AlertTriangle class="h-4 w-4" />
              <AlertTitle>{{ t('oauth.consent.errors.title') }}</AlertTitle>
              <AlertDescription>{{ error }}</AlertDescription>
            </Alert>

            <Button @click="returnToDashboard" variant="outline">
              {{ t('oauth.consent.errors.returnToDashboard') }}
            </Button>
          </div>

          <!-- Consent Form -->
          <div v-else-if="consentDetails" class="space-y-6">
            <!-- Application Info -->
            <div class="text-center">
              <div class="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Shield class="h-6 w-6 text-blue-600" />
              </div>
              <h2 class="text-lg font-semibold text-gray-900 mb-2">
                {{ t('oauth.consent.subtitle', { clientName }) }}
              </h2>
            </div>

            <!-- User Info -->
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-sm text-gray-600 mb-1">{{ t('oauth.consent.signedInAs') }}</p>
              <p class="font-medium text-gray-900">{{ consentDetails.user_email }}</p>
            </div>

            <!-- Permissions -->
            <div>
              <h3 class="text-sm font-medium text-gray-900 mb-3">
                {{ t('oauth.consent.permissionsTitle', { clientName }) }}
              </h3>

              <div class="space-y-3">
                <div
                  v-for="scope in scopesWithTranslations"
                  :key="scope.name"
                  class="bg-blue-50 rounded-lg p-3"
                >
                  <div class="flex items-start">
                    <CheckCircle class="h-4 w-4 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <p class="font-medium text-blue-900">{{ scope.displayName }}</p>
                      <p class="text-sm text-blue-800">{{ scope.displayDescription }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="space-y-3 pt-4">
              <Button
                @click="handleConsent('approve')"
                :disabled="processing"
                class="w-full"
                size="lg"
              >
                <span v-if="processing && action === 'approve'">
                  {{ t('oauth.consent.buttons.approving') }}
                </span>
                <span v-else>
                  {{ t('oauth.consent.buttons.allow') }}
                </span>
              </Button>

              <Button
                @click="handleConsent('deny')"
                :disabled="processing"
                variant="outline"
                class="w-full"
                size="lg"
              >
                <span v-if="processing && action === 'deny'">
                  {{ t('oauth.consent.buttons.denying') }}
                </span>
                <span v-else>
                  {{ t('oauth.consent.buttons.deny') }}
                </span>
              </Button>
            </div>
          </div>
        </CardContent>

        <!-- Security Notice -->
        <CardFooter v-if="consentDetails && !error" class="border-t bg-gray-50 text-center">
          <div class="text-xs text-gray-500 space-y-1">
            <p>{{ t('oauth.consent.security.redirectNotice', { clientName }) }}</p>
            <p>{{ t('oauth.consent.security.revokeNotice') }}</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
