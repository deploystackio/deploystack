<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock, AlertTriangle } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { UserService } from '@/services/userService'
import { Github } from 'lucide-vue-next'
import { getEnv } from '@/utils/env'

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
import { Spinner } from '@/components/ui/spinner'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const router = useRouter()
const isLoading = ref(false)
const errorMessage = ref('')
const githubOAuthEnabled = ref(false)
const { t } = useI18n() // Initialize i18n composable

// Define validation schema using Zod
const formSchema = toTypedSchema(
  z.object({
    login: z
      .string()
      .min(1, { message: t('validation.required', { field: t('login.form.email.label') }) })
      .email({ message: t('validation.email') }),
    password: z
      .string()
      .min(6, {
        message: t('validation.minLength', { field: t('login.form.password.label'), length: 6 }),
      }),
  })
)

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    login: '',
    password: '',
  },
})

// Clear error when user starts typing
const clearError = () => {
  errorMessage.value = ''
}

interface LoginError {
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
const handleError = (error: LoginError) => {
  if (error.name === 'TypeError' && error.message && error.message.includes('fetch')) {
    // Network error - backend is down
    errorMessage.value = t('login.errors.networkError')
  } else if (error.status && (error.status === 400 || error.status === 401)) {
    // Bad Request or Unauthorized - use backend error message if available, fallback to translation
    if (error.message && error.message !== `Login failed with status: ${error.status}`) {
      // Use the actual backend error message
      errorMessage.value = error.message
    } else {
      // Fallback to translation
      errorMessage.value = t('login.errors.invalidCredentials')
    }
  } else if (error.status && error.status >= 500) {
    // Server error
    errorMessage.value = t('login.errors.serverError')
  } else if (error.name === 'AbortError') {
    // Request timeout
    errorMessage.value = t('login.errors.timeout')
  } else {
    // Unknown error
    errorMessage.value = t('login.errors.unknownError')
  }
}

const onSubmit = form.handleSubmit(async (values) => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    // Use the UserService login method which handles cache clearing
    await UserService.login(values.login, values.password)
    router.push('/dashboard')

  } catch (e) {
    console.error('Login error:', e);
    const errorToHandle: LoginError = { message: t('login.errors.unknownError') };
    const potentialError = e as PotentialError;

    if (typeof potentialError.name === 'string') {
      errorToHandle.name = potentialError.name;
    }
    if (typeof potentialError.message === 'string') {
      errorToHandle.message = potentialError.message;
    }
    if (typeof potentialError.status === 'number') {
      errorToHandle.status = potentialError.status;
    }

    // If it's a standard Error instance, prefer its properties
    if (e instanceof Error) {
      errorToHandle.name = e.name;
      errorToHandle.message = e.message;
      // Check if the error has a status property (from our updated UserService)
      if ('status' in e && typeof (e as Error & { status?: number }).status === 'number') {
        errorToHandle.status = (e as Error & { status: number }).status;
      }
    }

    // Ensure message is always set if not already by previous checks
    if (!errorToHandle.message) {
        errorToHandle.message = t('login.errors.unknownError');
    }
    handleError(errorToHandle);
  } finally {
    isLoading.value = false
  }
})

const navigateToRegister = () => {
  router.push('/register')
}

// Check GitHub OAuth status
const checkGitHubOAuthStatus = async () => {
  try {
    const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
    if (!apiUrl) {
      console.error('API URL not configured')
      return false
    }

    const response = await fetch(`${apiUrl}/api/auth/github/status`)
    if (response.ok) {
      const status = await response.json()
      return status.enabled
    }
  } catch (error) {
    console.error('Failed to check GitHub OAuth status:', error)
  }
  return false
}

// Handle GitHub OAuth login
const handleGitHubLogin = async () => {
  try {
    const isEnabled = await checkGitHubOAuthStatus()
    if (!isEnabled) {
      errorMessage.value = t('login.oauth.github.unavailable')
      return
    }

    const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
    if (!apiUrl) {
      errorMessage.value = t('login.errors.networkError')
      return
    }

    // Redirect to GitHub OAuth endpoint
    window.location.href = `${apiUrl}/api/auth/github/login`
  } catch (error) {
    console.error('GitHub OAuth error:', error)
    errorMessage.value = t('login.errors.githubOAuthError')
  }
}

// Initialize GitHub OAuth status on component mount
onMounted(async () => {
  githubOAuthEnabled.value = await checkGitHubOAuthStatus()
})

</script>

<template>
  <div class="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <img
        class="mx-auto h-20 w-auto"
        src="/deploystack-logo-80x80.png"
        alt="DeployStack Logo"
      />
      <h2 class="mt-10 text-center text-2xl font-bold tracking-tight text-gray-900">
        DeployStack {{ $t('login.title') }}
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <!-- Error Alert -->
      <Alert v-if="errorMessage" variant="destructive" class="mb-6">
        <AlertTriangle class="h-4 w-4" />
        <AlertTitle>{{ $t('login.errors.title') }}</AlertTitle>
        <AlertDescription>
          {{ errorMessage }}
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent class="pt-6">
          <form @submit="onSubmit" class="space-y-6">
            <FormField v-slot="{ componentField }" name="login">
              <FormItem>
                <FormLabel>{{ $t('login.form.email.label') }}</FormLabel>
                <FormControl>
                  <div class="relative">
                    <Mail class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                      type="email"
                      :placeholder="$t('login.form.email.placeholder')"
                      v-bind="componentField"
                      class="pl-10"
                      autocomplete="email"
                      @input="clearError"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="password">
              <FormItem>
                <div class="flex items-center justify-between">
                  <FormLabel>{{ $t('login.form.password.label') }}</FormLabel>
                  <div class="text-sm">
                    <router-link
                      to="/forgot-password"
                      class="font-medium text-indigo-600 hover:text-indigo-500 text-sm"
                    >
                      {{ $t('login.form.forgotPassword') }}
                    </router-link>
                  </div>
                </div>
                <FormControl>
                  <div class="relative">
                    <Lock class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                      type="password"
                      :placeholder="$t('login.form.password.placeholder')"
                      v-bind="componentField"
                      class="pl-10"
                      autocomplete="current-password"
                      @input="clearError"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <Button
              type="submit"
              class="w-full"
              :disabled="isLoading"
            >
              <Spinner v-if="isLoading" class="mr-2" />
              {{ $t('login.buttons.submit') }}
            </Button>
          </form>

          <!-- GitHub OAuth Section -->
          <div v-if="githubOAuthEnabled" class="mt-6">
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <span class="w-full border-t" />
              </div>
              <div class="relative flex justify-center text-xs uppercase">
                <span class="bg-background px-2 text-muted-foreground">
                  {{ $t('login.oauth.divider') }}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              class="w-full mt-4"
              @click="handleGitHubLogin"
            >
              <Github class="mr-2 h-4 w-4" />
              {{ $t('login.oauth.github.button') }}
            </Button>
          </div>
        </CardContent>
        <CardFooter class="flex justify-center border-t p-6">
          <p class="text-center text-sm text-gray-500">
            {{ $t('login.noAccount') }}
            <Button
              variant="link"
              class="font-semibold text-indigo-600 hover:text-indigo-500 pl-1 pr-0"
              @click="navigateToRegister"
            >
              {{ $t('login.createAccount') }}

            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>

  </div>
</template>
