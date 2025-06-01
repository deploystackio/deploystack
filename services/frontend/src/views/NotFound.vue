<template>
  <div class="flex items-center min-h-screen px-4 py-12 sm:px-6 md:px-8 lg:px-12 xl:px-16">
    <div class="w-full space-y-6 text-center">
      <div class="space-y-3">
        <h1 class="text-4xl font-bold tracking-tighter sm:text-5xl transition-transform hover:scale-110">
          404
        </h1>
        <p class="text-gray-500">
          {{ t('notFound.description') }}
        </p>
      </div>
      <Button 
        @click="returnToWebsite"
        class="inline-flex h-10 items-center rounded-md bg-gray-900 px-8 text-sm font-medium text-gray-50 shadow transition-colors hover:bg-gray-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90 dark:focus-visible:ring-gray-300"
      >
        {{ t('notFound.returnButton') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'

const router = useRouter()
const { t } = useI18n()

const returnToWebsite = () => {
  router.push('/dashboard')
}
</script>
