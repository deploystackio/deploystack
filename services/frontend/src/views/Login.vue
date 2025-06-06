<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock, AlertTriangle } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { UserService } from '@/services/userService'

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
    // Bad Request or Unauthorized - invalid credentials
    errorMessage.value = t('login.errors.invalidCredentials')
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
    const data = await UserService.login(values.login, values.password)
    console.log('Login successful!', data)

    // Handle successful login - redirect to dashboard or home
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

import { getAllEnv } from '@/utils/env';

const allEnv = getAllEnv();

const navigateToRegister = () => {
  router.push('/register')
}

const navigateToForgotPassword = () => {
  router.push('/forgot-password')
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
        {{ $t('login.title') }}
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
                    <Button
                      variant="link"
                      class="font-medium text-indigo-600 hover:text-indigo-500 p-0 h-auto"
                      @click="navigateToForgotPassword"
                    >
                      {{ $t('login.form.forgotPassword') }}
                    </Button>
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

            <Button type="submit" class="w-full" :disabled="isLoading">
              {{ isLoading ? $t('login.buttons.loading') : $t('login.buttons.submit') }}
            </Button>
          </form>
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

<div>
  <pre>
    {{ allEnv }}
  </pre>
</div>

  </div>
</template>
