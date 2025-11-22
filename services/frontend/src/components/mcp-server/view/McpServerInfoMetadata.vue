<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Tag } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import CategoryDisplay from '@/components/mcp-server/CategoryDisplay.vue'

interface Props {
  tags?: string[] | string | null
  license?: string | null
  runtime: string
  transportType?: string | null
  categoryId?: string | null
}

const props = defineProps<Props>()
const { t } = useI18n()

const displayTags = computed(() => {
  if (!props.tags) return []
  if (Array.isArray(props.tags)) return props.tags
  try {
    return JSON.parse(props.tags as string)
  } catch {
    return []
  }
})
</script>

<template>
  <div class="space-y-4">
    <div v-if="displayTags.length > 0" class="space-y-2">
      <h3 class="text-sm font-semibold">{{ t('mcpInstallations.view.fields.tags') }}</h3>
      <div class="flex flex-wrap gap-1.5">
        <Badge
          v-for="tag in displayTags.slice(0, 8)"
          :key="tag"
          variant="outline"
          class="text-xs"
        >
          <Tag class="h-3 w-3 mr-1" />
          {{ tag }}
        </Badge>
      </div>
    </div>

    <div class="space-y-2">
      <h3 class="text-sm font-semibold">{{ t('mcpInstallations.view.fields.technical') }}</h3>
      <dl class="space-y-2 text-sm">
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">{{ t('mcpInstallations.view.values.runtime') }}</dt>
          <dd class="font-mono text-xs">{{ runtime }}</dd>
        </div>
        <div v-if="transportType" class="flex items-center justify-between">
          <dt class="text-muted-foreground">Transport Type</dt>
          <dd class="font-mono text-xs uppercase">{{ transportType }}</dd>
        </div>
        <div v-if="license" class="flex items-center justify-between">
          <dt class="text-muted-foreground">{{ t('mcpInstallations.view.values.license') }}</dt>
          <dd>{{ license }}</dd>
        </div>
      </dl>
    </div>

    <div v-if="categoryId" class="space-y-2">
      <h3 class="text-sm font-semibold">{{ t('mcpInstallations.view.fields.category') }}</h3>
      <CategoryDisplay
        :category-id="categoryId"
        :show-not-provided="false"
        text-class="text-sm"
      />
    </div>
  </div>
</template>
