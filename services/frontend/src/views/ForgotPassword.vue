<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { UserService } from '@/services/userService'

import {
  Card,
  CardContent,
} from '@/components/ui/card'

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



const onSubmit = form.handleSubmit(async (values) => {
  isLoading.value = true

  try {
    await UserService.requestPasswordReset(values.email)

    // Show success toast and redirect to login
    toast.success('Check your mailbox to reset password')

    // Redirect to login page
    router.push('/login')

  } catch (error) {
    console.error('Password reset request error:', error)
    
    // Show error toast
    toast.error(t('forgotPassword.errors.title'), {
      description: t('forgotPassword.errors.unknownError')
    })
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
        class="mx-auto h-20 w-auto"
        src="/deploystack-logo-80x80.png"
        alt="DeployStack Logo"
      />
      <h2 class="mt-10 text-center text-2xl font-bold tracking-tight text-gray-900">
        {{ $t('forgotPassword.title') }}
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        {{ $t('forgotPassword.subtitle') }}
      </p>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <Card>
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
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <Button 
              type="submit" 
              class="w-full" 
              :loading="isLoading"
              :loading-text="$t('forgotPassword.buttons.loading')"
            >
              {{ $t('forgotPassword.buttons.submit') }}
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
