<script setup lang="ts">
import { onMounted } from 'vue'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'

const { t } = useI18n()
const { setBreadcrumbs } = useBreadcrumbs()

onMounted(() => {
  setBreadcrumbs([{ label: t('pages.provider.title') }])
})
</script>

<template>
  <NavbarLayout>
    <div class="rounded-xl border bg-card text-card-foreground shadow">
      <div class="p-6">
        <h2 class="text-2xl font-bold">{{ t('pages.provider.title') }}</h2>
        <p class="text-muted-foreground mt-2">{{ t('pages.provider.description') }}</p>
        <div class="mt-6">
          <p class="text-sm text-muted-foreground">This page is under construction.</p>
        </div>
      </div>
    </div>
  </NavbarLayout>
</template>
