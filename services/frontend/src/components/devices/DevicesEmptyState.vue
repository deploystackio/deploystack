<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  Monitor
} from 'lucide-vue-next'

const { t } = useI18n()
</script>

<template>
  <!-- Empty State -->
  <div class="space-y-8">
    <div class="pt-20">
      <div
        class="relative block w-full max-w-2xl mx-auto rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 text-center transition-all duration-200"
      >
        <div class="mx-auto size-16 text-muted-foreground/60 transition-colors duration-200">
          <Monitor class="w-full h-full" stroke-width="1.25" />
        </div>
        <div class="mt-4 space-y-2">
          <span class="block text-sm font-semibold text-foreground transition-colors duration-200">
            {{ t('devices.emptyState.title') }}
          </span>
          <span class="block text-sm text-muted-foreground transition-colors duration-200">
            {{ t('devices.emptyState.description') }}
            <a
              href="https://www.npmjs.com/package/@deploystack/gateway"
              target="_blank"
              rel="noopener noreferrer"
              class="text-teal-700 hover:text-teal-800 underline decoration-teal-700/30 hover:decoration-teal-700/60 font-medium"
            >
              {{ t('devices.emptyState.deployStackCli') }}
            </a>{{ t('devices.emptyState.descriptionEnd') }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
