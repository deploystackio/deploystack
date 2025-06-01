<script setup lang="ts">
import DashboardLayout from '@/components/DashboardLayout.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <DashboardLayout :title="t('pages.credentials.title')">
    <div class="rounded-xl border bg-card text-card-foreground shadow">
      <div class="p-6">
        <h2 class="text-2xl font-bold">{{ t('pages.credentials.title') }}</h2>
        <p class="text-muted-foreground mt-2">{{ t('pages.credentials.description') }}</p>
        <div class="mt-6">
          <p class="text-sm text-muted-foreground">This page is under construction.</p>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
