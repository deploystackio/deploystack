<template>
  <div class="container mx-auto p-6">
    <h1 class="text-3xl font-bold mb-4">
      {{ t('globalSettings.title') }}
    </h1>
    <p class="text-gray-600">
      {{ t('globalSettings.description') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>
