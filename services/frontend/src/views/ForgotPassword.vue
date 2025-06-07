<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, AlertTriangle, CheckCircle } from 'lucide-vue-next'
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
const isLoading = ref(false)
const errorMessage = ref('')
const showSuccess = ref(false)
const { t } = useI18n()

// Define validation schema using Zod
const formSchema = toTypedSchema(
  z.object({
    email: z
      .string()
      .min(1, { message: t('validation.required') })
      .email({ message: t('validation.email') }),
  })
)

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    email: '',
  },
})

// Clear error when user starts typing
const clearError = () => {
  errorMessage.value = ''
}

interface ForgotPasswordError {
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
const handleError = (error: ForgotPasswordError) => {
  if (error.name === 'TypeError' && error.message && error.message.includes('fetch')) {
    // Network error - backend is down
    errorMessage.value = t('forgotPassword.errors.networkError')
  } else if (error.message === 'SERVICE_UNAVAILABLE') {
    // Service unavailable
    errorMessage.value = t('forgotPassword.errors.serviceUnavailable')
  } else if (error.status && error.status >= 500) {
    // Server error
    errorMessage.value = t('forgotPassword.errors.serverError')
  } else if (error.name === 'AbortError') {
    // Request timeout
    errorMessage.value = t('forgotPassword.errors.networkError')
  } else {
    // Unknown error
    errorMessage.value = t('forgotPassword.errors.unknownError')
  }
}

const onSubmit = form.handleSubmit(async (values) => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    await UserService.requestPasswordReset(values.email)
    
    // Always show success message for security (don't reveal if email exists)
    showSuccess.value = true

  } catch (e) {
    console.error('Password reset request error:', e);
    const errorToHandle: ForgotPasswordError = { message: t('forgotPassword.errors.unknownError') };
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
        errorToHandle.message = t('forgotPassword.errors.unknownError');
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
        {{ $t('forgotPassword.title') }}
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        {{ $t('forgotPassword.subtitle') }}
      </p>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <!-- Success Alert -->
      <Alert v-if="showSuccess" class="mb-6">
        <CheckCircle class="h-4 w-4" />
        <AlertTitle>{{ $t('forgotPassword.success.title') }}</AlertTitle>
        <AlertDescription>
          <div class="space-y-2">
            <p>{{ $t('forgotPassword.success.message') }}</p>
            <p class="text-sm">{{ $t('forgotPassword.success.instruction') }}</p>
          </div>
        </AlertDescription>
      </Alert>

      <!-- Error Alert -->
      <Alert v-if="errorMessage" variant="destructive" class="mb-6">
        <AlertTriangle class="h-4 w-4" />
        <AlertTitle>{{ $t('forgotPassword.errors.title') }}</AlertTitle>
        <AlertDescription>
          {{ errorMessage }}
        </AlertDescription>
      </Alert>

      <Card v-if="!showSuccess">
        <CardContent class="pt-6">
          <form @submit="onSubmit" class="space-y-6">
            <FormField v-slot="{ componentField }" name="email">
              <FormItem>
                <FormLabel>{{ $t('forgotPassword.form.email.label') }}</FormLabel>
                <FormControl>
                  <div class="relative">
                    <Mail class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                      type="email"
                      :placeholder="$t('forgotPassword.form.email.placeholder')"
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

            <Button type="submit" class="w-full" :disabled="isLoading">
              {{ isLoading ? $t('forgotPassword.buttons.loading') : $t('forgotPassword.buttons.submit') }}
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
          {{ $t('forgotPassword.buttons.backToLogin') }}
        </Button>
      </div>
    </div>
  </div>
</template>
