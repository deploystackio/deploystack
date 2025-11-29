<script setup lang="ts">
import { ref, computed } from 'vue'
import type { JsonAction } from '@/services/satelliteConfigService'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useI18n } from 'vue-i18n'

interface Props {
  action: JsonAction
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

const jsonContent = computed(() => {
  // Use pre-formatted jsonContent if available
  if (props.action.jsonContent) {
    return props.action.jsonContent
  }

  // Otherwise format the data fields
  const data = props.action.servers || props.action.mcpServers || props.action.inputs
  return JSON.stringify(data, null, 2)
})

async function handleCopy() {
  isCopying.value = true
  emit('copy', jsonContent.value)
  isCopying.value = false
}
</script>

<template>
  <div class="space-y-2">
    <label v-if="action.title" class="text-sm font-medium">{{ action.title }}</label>
    <p v-if="action.description" class="text-sm text-muted-foreground">{{ action.description }}</p>

    <Input
      v-if="action.inputType === 'input'"
      :model-value="jsonContent"
      class="font-mono text-sm"
      readonly
    />
    <Textarea
      v-else
      :model-value="jsonContent"
      class="min-h-[200px] font-mono text-sm"
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
