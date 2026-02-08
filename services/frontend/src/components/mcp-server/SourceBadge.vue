<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Badge } from '@/components/ui/badge'
import { Package, Github, Cloud } from 'lucide-vue-next'

interface Props {
  source?: 'official_registry' | 'manual' | 'github' | null
  runtime?: string | null
}

const props = defineProps<Props>()
const { t } = useI18n()

const sourceType = computed(() => {
  if (props.source === 'github') return 'github'
  if (props.runtime === 'http' || props.runtime === 'sse') return 'remote'
  return 'catalog'
})

const sourceLabel = computed(() => {
  if (sourceType.value === 'github') return t('mcpCatalog.source.github')
  if (sourceType.value === 'remote') return t('mcpCatalog.source.remote')
  return t('mcpCatalog.source.catalog')
})

const badgeVariant = computed(() => {
  if (sourceType.value === 'github') return 'default'
  if (sourceType.value === 'remote') return 'secondary'
  return 'outline'
})
</script>

<template>
  <Badge :variant="badgeVariant" class="flex items-center gap-1">
    <Github v-if="sourceType === 'github'" class="h-3 w-3" />
    <Cloud v-else-if="sourceType === 'remote'" class="h-3 w-3" />
    <Package v-else class="h-3 w-3" />
    <span>{{ sourceLabel }}</span>
  </Badge>
</template>
