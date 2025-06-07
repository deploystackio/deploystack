<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Lock, AlertTriangle, CheckCircle } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { UserService } from '@/services/userService'

import {
  Card,
  CardContent,
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
const route = useRoute()
const isLoading = ref(false)
const errorMessage = ref('')
const showSuccess = ref(false)
const token = ref('')
const { t } = useI18n()

// Define validation schema using Zod
const formSchema = toTypedSchema(
  z.object({
    password: z
      .string()
      .min(8, { message: t('validation.minLength', { length: 8 }) }),
    confirmPassword: z
      .string()
      .min(1, { message: t('validation.required') }),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('validation.passwordMatch'),
    path: ['confirmPassword'],
  })
)

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    password: '',
    confirmPassword: '',
  },
})

// Clear error when user starts typing
const clearError = () => {
  errorMessage.value = ''
}

interface ResetPasswordError {
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
const handleError = (error: ResetPasswordError) => {
  if (error.name === 'TypeError' && error.message && error.message.includes('fetch')) {
    // Network error - backend is down
    errorMessage.value = t('resetPassword.errors.networkError')
  } else if (error.message === 'INVALID_TOKEN') {
    // Invalid or expired token
    errorMessage.value = t('resetPassword.errors.invalidToken')
  } else if (error.message === 'FORBIDDEN') {
    // User not eligible for password reset
    errorMessage.value = t('resetPassword.errors.invalidToken')
  } else if (error.message === 'SERVICE_UNAVAILABLE') {
    // Service unavailable
    errorMessage.value = t('resetPassword.errors.serviceUnavailable')
  } else if (error.status && error.status >= 500) {
    // Server error
    errorMessage.value = t('resetPassword.errors.serverError')
  } else if (error.name === 'AbortError') {
    // Request timeout
    errorMessage.value = t('resetPassword.errors.networkError')
  } else {
    // Unknown error
    errorMessage.value = t('resetPassword.errors.unknownError')
  }
}

const onSubmit = form.handleSubmit(async (values) => {
  if (!token.value) {
    errorMessage.value = t('resetPassword.errors.invalidToken')
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await UserService.resetPassword(token.value, values.password)
    
    // Show success message
    showSuccess.value = true

    // Redirect to login after 3 seconds
    setTimeout(() => {
      router.push('/login')
    }, 3000)

  } catch (e) {
    console.error('Password reset error:', e);
    const errorToHandle: ResetPasswordError = { message: t('resetPassword.errors.unknownError') };
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
        errorToHandle.message = t('resetPassword.errors.unknownError');
    }
    handleError(errorToHandle);
  } finally {
    isLoading.value = false
  }
})

const navigateToLogin = () => {
  router.push('/login')
}

// Extract token from URL on component mount
onMounted(() => {
  const urlToken = route.query.token as string
  if (!urlToken) {
    errorMessage.value = t('resetPassword.errors.invalidToken')
    return
  }
  token.value = urlToken
})
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
        {{ $t('resetPassword.title') }}
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        {{ $t('resetPassword.subtitle') }}
      </p>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <!-- Success Alert -->
      <Alert v-if="showSuccess" class="mb-6">
        <CheckCircle class="h-4 w-4" />
        <AlertTitle>{{ $t('resetPassword.success.title') }}</AlertTitle>
        <AlertDescription>
          <div class="space-y-2">
            <p>{{ $t('resetPassword.success.message') }}</p>
            <p class="text-sm">{{ $t('resetPassword.success.instruction') }}</p>
          </div>
        </AlertDescription>
      </Alert>

      <!-- Error Alert -->
      <Alert v-if="errorMessage" variant="destructive" class="mb-6">
        <AlertTriangle class="h-4 w-4" />
        <AlertTitle>{{ $t('resetPassword.errors.title') }}</AlertTitle>
        <AlertDescription>
          {{ errorMessage }}
        </AlertDescription>
      </Alert>

      <Card v-if="!showSuccess && token">
        <CardContent class="pt-6">
          <form @submit="onSubmit" class="space-y-6">
            <FormField v-slot="{ componentField }" name="password">
              <FormItem>
                <FormLabel>{{ $t('resetPassword.form.password.label') }}</FormLabel>
                <FormControl>
                  <div class="relative">
                    <Lock class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                      type="password"
                      :placeholder="$t('resetPassword.form.password.placeholder')"
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
                <FormLabel>{{ $t('resetPassword.form.confirmPassword.label') }}</FormLabel>
                <FormControl>
                  <div class="relative">
                    <Lock class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                      type="password"
                      :placeholder="$t('resetPassword.form.confirmPassword.placeholder')"
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

            <Button type="submit" class="w-full" :disabled="isLoading">
              {{ isLoading ? $t('resetPassword.buttons.loading') : $t('resetPassword.buttons.submit') }}
            </Button>
          </form>
        </CardContent>
      </Card>

      <!-- Back to Login -->
      <div class="mt-6 text-center">
        <Button
          variant="link"
          class="font-medium text-indigo-600 hover:text-indigo-500"
          @click="navigateToLogin"
        >
          {{ $t('resetPassword.buttons.backToLogin') }}
        </Button>
      </div>
    </div>
  </div>
</template>
