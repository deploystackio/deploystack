<script setup lang="ts">
import { ref } from 'vue'
import type { CommandAction } from '@/services/satelliteConfigService'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useI18n } from 'vue-i18n'

interface Props {
  action: CommandAction
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
  emit('copy', props.action.command)
  isCopying.value = false
}
</script>

<template>
  <div class="space-y-2">
    <label v-if="action.title" class="text-sm font-medium">{{ action.title }}</label>
    <p v-if="action.description" class="text-sm text-muted-foreground">{{ action.description }}</p>

    <Input
      v-if="action.inputType === 'input'"
      :model-value="action.command"
      class="font-mono text-sm bg-gray-50 dark:bg-gray-900"
      readonly
    />
    <Textarea
      v-else
      :model-value="action.command"
      class="min-h-[100px] font-mono text-sm bg-white dark:bg-gray-900"
      readonly
    />

    <div v-if="showCopyButton" class="flex justify-end">
      <Button
        @click="handleCopy"
        :loading="isCopying"
        loading-text="Copying..."
      >
        {{ t('satelliteConfig.button.copy') }}
      </Button>
    </div>
  </div>
</template>
