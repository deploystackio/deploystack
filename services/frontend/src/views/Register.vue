<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock, User, AlertTriangle } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
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
const successMessage = ref('')
const { t } = useI18n() // Initialize i18n composable

// Get API URL from environment
const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

// Define validation schema using Zod
const formSchema = toTypedSchema(
  z
    .object({
      name: z
        .string()
        .min(2, {
          message: t('validation.minLength', { field: t('register.form.name.label'), length: 2 }),
        })
        .max(50, {
          message: t('validation.maxLength', { field: t('register.form.name.label'), length: 50 }),
        }),
      email: z
        .string()
        .min(1, { message: t('validation.required', { field: t('register.form.email.label') }) })
        .email({ message: t('validation.email') }),
      password: z
        .string()
        .min(6, {
          message: t('validation.minLength', {
            field: t('register.form.password.label'),
            length: 6,
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
)

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  },
})

// Clear error when user starts typing
const clearError = () => {
  errorMessage.value = ''
  successMessage.value = ''
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

// Handle different types of errors
const handleError = (error: RegisterError) => {
  if (error.name === 'TypeError' && error.message && error.message.includes('fetch')) {
    // Network error - backend is down
    errorMessage.value = 'Unable to connect to server. Please try again later.'
  } else if (error.status && error.status === 409) {
    // Conflict - username or email already exists
    errorMessage.value = error.message || 'Username or email already exists.'
  } else if (error.status && error.status >= 500) {
    // Server error
    errorMessage.value = 'Server error occurred. Please try again later.'
  } else if (error.name === 'AbortError') {
    // Request timeout
    errorMessage.value = 'Request timed out. Please try again.'
  } else {
    // Unknown error
    errorMessage.value = error.message || 'An unexpected error occurred during registration.'
  }
}

const onSubmit = form.handleSubmit(async (values) => {
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

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

    const data = await response.json()
    console.log('Registration successful!', data)

    // Show success message
    successMessage.value = 'Account created successfully! Redirecting to login...'

    // Redirect to login page after a short delay
    setTimeout(() => {
      router.push('/login')
    }, 2000)

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
</script>

<template>
  <div class="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <img
        class="mx-auto h-10 w-auto"
        src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
        alt="Your Company"
      />
      <h2 class="mt-10 text-center text-2xl font-bold tracking-tight text-gray-900">
        {{ $t('register.title') }}
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <!-- Error Alert -->
      <Alert v-if="errorMessage" variant="destructive" class="mb-6">
        <AlertTriangle class="h-4 w-4" />
        <AlertTitle>Registration Error</AlertTitle>
        <AlertDescription>
          {{ errorMessage }}
        </AlertDescription>
      </Alert>

      <!-- Success Alert -->
      <Alert v-if="successMessage" class="mb-6">
        <AlertTriangle class="h-4 w-4" />
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>
          {{ successMessage }}
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent class="pt-6">
          <form @submit="onSubmit" class="space-y-4">
            <FormField v-slot="{ componentField }" name="name">
              <FormItem>
                <FormLabel>{{ $t('register.form.name.label') }}</FormLabel>
                <FormControl>
                  <div class="relative">
                    <User class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                      type="text"
                      :placeholder="$t('register.form.name.placeholder')"
                      v-bind="componentField"
                      class="pl-10"
                      autocomplete="name"
                      @input="clearError"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="email">
              <FormItem>
                <FormLabel>{{ $t('register.form.email.label') }}</FormLabel>
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
                <FormLabel>{{ $t('register.form.password.label') }}</FormLabel>
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
                <FormLabel>{{ $t('register.form.confirmPassword.label') }}</FormLabel>
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

            <Button type="submit" class="w-full mt-6" :disabled="isLoading">
              {{ isLoading ? $t('register.buttons.loading') : $t('register.buttons.submit') }}
            </Button>
          </form>
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
