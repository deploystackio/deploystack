<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  installationId: string
  repositoryName: string
  branch: string
  commitSha: string
}

defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <div>
    <div class="space-y-6 py-8">
    <!-- Success Description -->
    <div class="text-center">
      <p class="text-muted-foreground">
        {{ t('deployments.wizard.success.description') }}
      </p>
    </div>

    <!-- Deployment Details -->
    <div class="mt-6">
      <dl class="divide-y divide-neutral-100 dark:divide-neutral-800">
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {{ t('deployments.wizard.success.repository') }}
          </dt>
          <dd class="mt-1 text-sm text-neutral-700 dark:text-neutral-300 sm:col-span-2 sm:mt-0 font-mono">
            {{ repositoryName }}
          </dd>
        </div>
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {{ t('deployments.wizard.success.branch') }}
          </dt>
          <dd class="mt-1 text-sm text-neutral-700 dark:text-neutral-300 sm:col-span-2 sm:mt-0 font-mono">
            {{ branch }}
          </dd>
        </div>
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {{ t('deployments.wizard.success.commitSha') }}
          </dt>
          <dd class="mt-1 text-sm text-neutral-700 dark:text-neutral-300 sm:col-span-2 sm:mt-0 font-mono">
            {{ commitSha.substring(0, 8) }}
          </dd>
        </div>
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {{ t('deployments.wizard.success.status') }}
          </dt>
          <dd class="mt-1 text-sm text-green-600 dark:text-green-400 sm:col-span-2 sm:mt-0 font-semibold">
            {{ t('deployments.wizard.success.online') }}
          </dd>
        </div>
      </dl>
    </div>
    </div>
  </div>
</template>
