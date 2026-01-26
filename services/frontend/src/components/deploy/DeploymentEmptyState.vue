<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { Package } from 'lucide-vue-next'

defineEmits<{
  'deploy-new': []
}>()

const { t } = useI18n()
</script>

<template>
  <Empty class="border border-solid">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <Package />
      </EmptyMedia>
      <EmptyTitle>{{ t('deployments.emptyState.title') }}</EmptyTitle>
      <EmptyDescription>
        {{ t('deployments.emptyState.description') }}
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button @click="$emit('deploy-new')">
        {{ t('deployments.emptyState.action') }}
      </Button>
    </EmptyContent>
  </Empty>
</template>
