<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Lock } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { UserService } from '@/services/userService'

import {
  Card,
  CardContent,
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
const route = useRoute()
const isLoading = ref(false)
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



const onSubmit = form.handleSubmit(async (values) => {
  if (!token.value) {
    toast.error('Invalid reset token')
    return
  }

  isLoading.value = true

  try {
    await UserService.resetPassword(token.value, values.password)

    // Show success toast and redirect to login
    toast.success('Password reset successfully! Redirecting to login...')

    // Redirect to login page
    router.push('/login')

  } catch (error) {
    console.error('Password reset error:', error)
    
    // Show error toast
    toast.error('Failed to reset password', {
      description: 'Please try again or request a new reset link'
    })
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
    toast.error('Missing or invalid reset token')
    return
  }
  token.value = urlToken
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
        {{ $t('resetPassword.title') }}
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        {{ $t('resetPassword.subtitle') }}
      </p>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <Card v-if="token">
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
              {{ $t('resetPassword.buttons.submit') }}
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
