<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock, User } from 'lucide-vue-next'
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

const onSubmit = form.handleSubmit((values) => {
  // Mock registration functionality
  isLoading.value = true

  // Simulate API call
  setTimeout(() => {
    console.log('Registration submitted!', values)
    isLoading.value = false
    // In a real app, you would handle account creation here
  }, 1000)
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
