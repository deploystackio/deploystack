<script setup lang="ts">
import { ref } from 'vue'
import type { TextAction } from '@/services/satelliteConfigService'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useI18n } from 'vue-i18n'

interface Props {
  action: TextAction
  showCopyButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showCopyButton: true
})

const emit = defineEmits<{
  copy: [content: string]
}>()

const { t } = useI18n()
const isCopying = ref(false)

async function handleCopy() {
  isCopying.value = true
  emit('copy', props.action.content)
  isCopying.value = false
}
</script>

<template>
  <div class="space-y-2">
    <label v-if="action.title" class="text-sm font-medium">{{ action.title }}</label>
    <p v-if="action.description" class="text-sm text-muted-foreground">{{ action.description }}</p>

    <Textarea
      :model-value="action.content"
      class="min-h-[400px] font-sans text-sm leading-relaxed"
      readonly
    />

    <div v-if="showCopyButton" class="flex justify-end">
      <Button
        @click="handleCopy"
        :disabled="isCopying"
      >
        <Spinner v-if="isCopying" class="mr-2" />
        {{ t('satelliteConfig.button.copy') }}
      </Button>
    </div>
  </div>
</template>
