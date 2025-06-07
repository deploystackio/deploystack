<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { CheckCircle, XCircle, Mail, Loader2, AlertTriangle } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { getEnv } from '@/utils/env'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'

import { Button } from '@/components/ui/button'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

// Get API URL from environment
const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

// Component state
const isLoading = ref(true)
const isVerified = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const isResending = ref(false)
const resendEmail = ref('')

// Get token from URL query parameters
const token = ref(route.query.token as string || '')

interface VerificationError {
  name?: string;
  message?: string;
  status?: number;
}

interface PotentialError {
  name?: unknown;
  message?: unknown;
  status?: unknown;
}

// Handle different types of errors
const handleError = (error: VerificationError) => {
  if (error.name === 'TypeError' && error.message && error.message.includes('fetch')) {
    errorMessage.value = t('verifyEmail.errors.networkError')
  } else if (error.status === 400) {
    errorMessage.value = error.message || t('verifyEmail.errors.invalidToken')
  } else if (error.status && error.status >= 500) {
    errorMessage.value = t('verifyEmail.errors.serverError')
  } else if (error.name === 'AbortError') {
    errorMessage.value = t('verifyEmail.errors.timeout')
  } else {
    errorMessage.value = error.message || t('verifyEmail.errors.unknownError')
  }
}

// Verify email with token
const verifyEmail = async () => {
  if (!token.value) {
    errorMessage.value = t('verifyEmail.errors.noToken')
    isLoading.value = false
    return
  }

  try {
    isLoading.value = true
    errorMessage.value = ''

    // Create AbortController for timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(`${apiUrl}/api/auth/email/verify?token=${encodeURIComponent(token.value)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const data = await response.json()

    if (!response.ok) {
      const error = new Error(data.error || 'Verification failed') as Error & { status: number }
      error.status = response.status
      throw error
    }

    // Success
    isVerified.value = true
    successMessage.value = data.message || 'Email verified successfully! You can now log in to your account.'

  } catch (e) {
    console.error('Email verification error:', e)
    const errorToHandle: VerificationError = { message: 'An unexpected error occurred during verification.' }
    const potentialError = e as PotentialError

    if (typeof potentialError.name === 'string') {
      errorToHandle.name = potentialError.name
    }
    if (typeof potentialError.message === 'string') {
      errorToHandle.message = potentialError.message
    }
    if (typeof potentialError.status === 'number') {
      errorToHandle.status = potentialError.status
    }

    // If it's a standard Error instance, prefer its properties
    if (e instanceof Error) {
      errorToHandle.name = e.name
      errorToHandle.message = e.message
    }

    handleError(errorToHandle)
  } finally {
    isLoading.value = false
  }
}

// Resend verification email
const resendVerification = async () => {
  if (!resendEmail.value) {
    errorMessage.value = t('verifyEmail.errors.enterEmail')
    return
  }

  try {
    isResending.value = true
    errorMessage.value = ''

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${apiUrl}/api/auth/email/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: resendEmail.value,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const data = await response.json()

    if (!response.ok) {
      const error = new Error(data.error || 'Failed to resend verification email') as Error & { status: number }
      error.status = response.status
      throw error
    }

    // Success
    successMessage.value = data.message || 'Verification email sent successfully. Please check your inbox.'
    resendEmail.value = '' // Clear the email field

  } catch (e) {
    console.error('Resend verification error:', e)
    const errorToHandle: VerificationError = { message: 'An unexpected error occurred while sending verification email.' }
    const potentialError = e as PotentialError

    if (typeof potentialError.name === 'string') {
      errorToHandle.name = potentialError.name
    }
    if (typeof potentialError.message === 'string') {
      errorToHandle.message = potentialError.message
    }
    if (typeof potentialError.status === 'number') {
      errorToHandle.status = potentialError.status
    }

    if (e instanceof Error) {
      errorToHandle.name = e.name
      errorToHandle.message = e.message
    }

    handleError(errorToHandle)
  } finally {
    isResending.value = false
  }
}

// Navigate to login page
const navigateToLogin = () => {
  router.push('/login')
}

// Navigate to register page
const navigateToRegister = () => {
  router.push('/register')
}

// Clear messages
const clearMessages = () => {
  errorMessage.value = ''
  successMessage.value = ''
}

// Verify email on component mount
onMounted(() => {
  verifyEmail()
})
</script>

<template>
  <div class="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img
        class="mx-auto h-10 w-auto"
        src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
        alt="Your Company"
      />
      <h2 class="mt-10 text-center text-2xl font-bold tracking-tight text-gray-900">
        {{ $t('verifyEmail.title') }}
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
      <!-- Loading State -->
      <Card v-if="isLoading">
        <CardContent class="pt-6">
          <div class="flex flex-col items-center justify-center py-8">
            <Loader2 class="h-8 w-8 animate-spin text-indigo-600 mb-4" />
            <p class="text-gray-600 text-center">{{ $t('verifyEmail.loading.message') }}</p>
          </div>
        </CardContent>
      </Card>

      <!-- Success State -->
      <Card v-else-if="isVerified && !errorMessage">
        <CardContent class="pt-6">
          <div class="flex flex-col items-center justify-center py-8">
            <CheckCircle class="h-12 w-12 text-green-600 mb-4" />
            <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ $t('verifyEmail.success.title') }}</h3>
            <p class="text-gray-600 text-center mb-6">{{ successMessage }}</p>
            <Button @click="navigateToLogin" class="w-full">
              {{ $t('verifyEmail.success.button') }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Error State -->
      <Card v-else>
        <CardHeader>
          <CardTitle class="flex items-center">
            <XCircle class="h-6 w-6 text-red-600 mr-2" />
            {{ $t('verifyEmail.error.title') }}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <!-- Error Alert -->
          <Alert variant="destructive" class="mb-6">
            <AlertTriangle class="h-4 w-4" />
            <AlertTitle>{{ $t('verifyEmail.error.alertTitle') }}</AlertTitle>
            <AlertDescription>
              {{ errorMessage }}
            </AlertDescription>
          </Alert>

          <!-- Success Alert for Resend -->
          <Alert v-if="successMessage" class="mb-6">
            <Mail class="h-4 w-4" />
            <AlertTitle>{{ $t('verifyEmail.alerts.emailSent') }}</AlertTitle>
            <AlertDescription>
              {{ successMessage }}
            </AlertDescription>
          </Alert>

          <!-- Resend Verification Section -->
          <div class="space-y-4">
            <div>
              <label for="resend-email" class="block text-sm font-medium text-gray-900 mb-2">
                {{ $t('verifyEmail.error.resendSection.title') }}
              </label>
              <div class="relative">
                <Mail class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="resend-email"
                  v-model="resendEmail"
                  type="email"
                  :placeholder="$t('verifyEmail.error.resendSection.placeholder')"
                  class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  @input="clearMessages"
                />
              </div>
            </div>

            <Button
              @click="resendVerification"
              :disabled="isResending || !resendEmail"
              class="w-full"
              variant="outline"
            >
              <Loader2 v-if="isResending" class="h-4 w-4 animate-spin mr-2" />
              {{ isResending ? $t('verifyEmail.error.resendSection.buttonSending') : $t('verifyEmail.error.resendSection.button') }}
            </Button>

            <div class="flex space-x-3">
              <Button @click="navigateToLogin" variant="outline" class="flex-1">
                {{ $t('verifyEmail.error.navigation.backToLogin') }}
              </Button>
              <Button @click="navigateToRegister" variant="outline" class="flex-1">
                {{ $t('verifyEmail.error.navigation.registerAgain') }}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
