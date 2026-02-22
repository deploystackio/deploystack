<script setup lang="ts">
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock, User } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { getEnv } from '@/utils/env'
import { Github } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card'

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
const githubOAuthEnabled = ref(false)
const { t } = useI18n()

// Get API URL from environment
const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

// Define validation schema using Zod
const formSchema = z
  .object({
    name: z
      .string()
      .min(3, {
        message: t('validation.minLength', { field: t('register.form.name.label'), length: 3 }),
      })
      .max(30, {
        message: t('validation.maxLength', { field: t('register.form.name.label'), length: 30 }),
      })
      .regex(/^[a-zA-Z0-9_.-]+$/, {
        message: 'Username can only contain letters, numbers, underscores, dots, and hyphens (no spaces)',
      }),
    email: z
      .string()
      .min(1, { message: t('validation.required', { field: t('register.form.email.label') }) })
      .email({ message: t('validation.email') }),
    password: z
      .string()
      .min(8, {
        message: t('validation.minLength', {
          field: t('register.form.password.label'),
          length: 8,
        }),
      })
      .max(100, {
        message: t('validation.maxLength', {
          field: t('register.form.password.label'),
          length: 100,
        }),
      }),
    confirmPassword: z
      .string()
      .min(1, {
        message: t('validation.required', { field: t('register.form.confirmPassword.label') }),
      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: t('validation.passwordMatch'),
    path: ['confirmPassword'],
  })

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  },
})

// Clear any existing toasts when user starts typing
const clearError = () => {
  // Toasts auto-dismiss, no manual clearing needed
}

interface RegisterError {
  name?: string;
  message?: string;
  status?: number;
}

interface PotentialError {
  name?: unknown;
  message?: unknown;
  status?: unknown;
}

// Handle different types of errors with Sonner toasts
const handleError = (error: RegisterError) => {
  let message = ''
  
  if (error.name === 'TypeError' && error.message && error.message.includes('fetch')) {
    // Network error - backend is down
    message = t('register.errors.networkError', 'Unable to connect to server. Please try again later.')
  } else if (error.status && error.status === 409) {
    // Conflict - username or email already exists
    message = error.message || t('register.errors.conflict', 'Username or email already exists.')
  } else if (error.status && error.status >= 500) {
    // Server error
    message = t('register.errors.serverError', 'Server error occurred. Please try again later.')
  } else if (error.name === 'AbortError') {
    // Request timeout
    message = t('register.errors.timeout', 'Request timed out. Please try again.')
  } else {
    // Unknown error
    message = error.message || t('register.errors.unknownError', 'An unexpected error occurred during registration.')
  }
  
  toast.error(t('register.errors.title', 'Registration Error'), {
    description: message
  })
}

const onSubmit = form.handleSubmit(async (values) => {
  isLoading.value = true

  try {
    // Create AbortController for timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(`${apiUrl}/api/auth/email/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: values.name, // Map 'name' to 'username' for backend
        email: values.email,
        password: values.password,
        // Optional: you could split name into first_name and last_name
        // first_name: values.name.split(' ')[0],
        // last_name: values.name.split(' ').slice(1).join(' ') || undefined,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const error = new Error(errorData.error || 'Registration failed') as Error & { status: number }
      error.status = response.status
      throw error
    }

    await response.json()
    
    // Show success toast and redirect to login
    toast.success(t('register.success.title', 'Account created successfully!'), {
      description: t('register.success.description', 'You can now sign in with your credentials.')
    })
    
    // Immediate redirect to login
    router.push('/login')

  } catch (e) {
    console.error('Registration error:', e);
    const errorToHandle: RegisterError = { message: t('register.errors.unknownError', 'An unexpected error occurred during registration.') }; // Default message
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
    }

    // Ensure message is always set if not already by previous checks
    if (!errorToHandle.message) {
        errorToHandle.message = t('register.errors.unknownError', 'An unexpected error occurred during registration.');
    }
    handleError(errorToHandle);
  } finally {
    isLoading.value = false
  }
})

const navigateToLogin = () => {
  router.push('/login')
}

// Check GitHub OAuth status
const checkGitHubOAuthStatus = async () => {
  try {
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

// Handle GitHub OAuth signup
const handleGitHubSignup = async () => {
  try {
    const isEnabled = await checkGitHubOAuthStatus()
    if (!isEnabled) {
      toast.error(t('register.errors.title', 'Registration Error'), {
        description: t('login.oauth.github.unavailable', 'GitHub OAuth is not available')
      })
      return
    }

    if (!apiUrl) {
      toast.error(t('register.errors.title', 'Registration Error'), {
        description: t('login.errors.networkError', 'Network error occurred')
      })
      return
    }

    // Redirect to GitHub OAuth endpoint (same as login)
    window.location.href = `${apiUrl}/api/auth/github/login`
  } catch (error) {
    console.error('GitHub OAuth error:', error)
    toast.error(t('register.errors.title', 'Registration Error'), {
      description: t('login.errors.githubOAuthError', 'GitHub OAuth error occurred')
    })
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
        DeployStack {{ $t('register.title') }}
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <Card>
        <CardContent class="pt-6">
          <form @submit="onSubmit" class="space-y-4">
            <FormField v-slot="{ componentField }" name="name">
              <FormItem>
                <FormLabel class="text-gray-900 font-medium">{{ $t('register.form.name.label') }}</FormLabel>
                <FormControl>
                  <div class="relative">
                    <User class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                      type="text"
                      placeholder="Enter username (letters, numbers, underscores, dots, hyphens only)"
                      v-bind="componentField"
                      class="pl-10"
                      autocomplete="username"
                      @input="clearError"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="email">
              <FormItem>
                <FormLabel class="text-gray-900 font-medium">{{ $t('register.form.email.label') }}</FormLabel>
                <FormControl>
                  <div class="relative">
                    <Mail class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                      type="email"
                      :placeholder="$t('register.form.email.placeholder')"
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
                <FormLabel class="text-gray-900 font-medium">{{ $t('register.form.password.label') }}</FormLabel>
                <FormControl>
                  <div class="relative">
                    <Lock class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                      type="password"
                      :placeholder="$t('register.form.password.placeholder')"
                      v-bind="componentField"
                      class="pl-10"
                      autocomplete="new-password"
                      @input="clearError"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="confirmPassword">
              <FormItem>
                <FormLabel class="text-gray-900 font-medium">{{ $t('register.form.confirmPassword.label') }}</FormLabel>
                <FormControl>
                  <div class="relative">
                    <Lock class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                      type="password"
                      :placeholder="$t('register.form.confirmPassword.placeholder')"
                      v-bind="componentField"
                      class="pl-10"
                      autocomplete="new-password"
                      @input="clearError"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <Button
              type="submit"
              class="w-full mt-6"
              :disabled="isLoading"
            >
              <Spinner v-if="isLoading" class="mr-2" />
              {{ $t('register.buttons.submit') }}
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
              @click="handleGitHubSignup"
            >
              <Github class="mr-2 h-4 w-4" />
              {{ $t('login.oauth.github.signup') }}
            </Button>
          </div>
        </CardContent>
        <CardFooter class="flex justify-center border-t p-6">
          <p class="text-center text-sm text-gray-500">
            {{ $t('register.haveAccount') }}
            <Button
              variant="link"
              class="font-semibold text-indigo-600 hover:text-indigo-500 pl-1 pr-0"
              @click="navigateToLogin"
            >
              {{ $t('register.signIn') }}
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
