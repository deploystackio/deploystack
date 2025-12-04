<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { UserService } from '@/services/userService'

const router = useRouter()
const { t } = useI18n()

const isLoading = ref(true)
const message = ref('')

onMounted(async () => {
  isLoading.value = true
  message.value = t('logout.inProgressMessage')
  try {
    await UserService.logout()
    message.value = t('logout.successMessage')
  } catch (error) {
    console.error('Error during logout:', error)
    message.value = t('common.error')
  } finally {
    isLoading.value = false
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  }
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
        {{ $t('logout.title') }}
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <Card>
        <CardContent class="pt-6">
          <p class="text-center text-muted-foreground">
            {{ message }}
          </p>
          <div v-if="isLoading" class="mt-4 flex justify-center">
            <Spinner class="h-8 w-8" />
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
