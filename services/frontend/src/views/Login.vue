<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import {
  Card,
  CardContent,
  CardFooter,
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
const { t } = useI18n() // Initialize i18n composable

// Define validation schema using Zod
const formSchema = toTypedSchema(
  z.object({
    email: z
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
    email: '',
    password: '',
  },
})

const onSubmit = form.handleSubmit((values) => {
  // Mock login functionality
  isLoading.value = true

  // Simulate API call
  setTimeout(() => {
    console.log('Login submitted!', values)
    isLoading.value = false
    // In a real app, you would handle authentication here
  }, 1000)
})

import { getEnv, getAllEnv } from '@/utils/env';

const apiUrl = getEnv('VITE_API_URL');

const allEnv = getAllEnv();

const navigateToRegister = () => {
  router.push('/register')
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
      <Card>
        <CardContent class="pt-6">
          <form @submit="onSubmit" class="space-y-6">
            <FormField v-slot="{ componentField }" name="email">
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
                    <a href="#" class="font-medium text-indigo-600 hover:text-indigo-500">
                      {{ $t('login.form.forgotPassword') }}
                    </a>
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

              <p>Test env: {{ apiUrl }}</p>

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
