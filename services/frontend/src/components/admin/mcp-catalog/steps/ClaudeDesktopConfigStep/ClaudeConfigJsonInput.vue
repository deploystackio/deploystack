<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, AlertCircle } from 'lucide-vue-next'

interface Props {
  modelValue: string
  isValid: boolean
  hasError: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  format: []
}>()

const { t } = useI18n()

const hasContent = computed(() => props.modelValue.trim().length > 0)
const statusIcon = computed(() => props.isValid ? CheckCircle : AlertCircle)
const statusColor = computed(() => props.isValid ? 'text-green-600' : 'text-red-600')

const handleFormat = () => {
  emit('format')
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <Label for="claude-config">{{ t('mcpCatalog.form.claudeConfig.label') }}</Label>
      <div v-if="hasContent" class="flex items-center gap-2">
        <component :is="statusIcon" :class="['h-4 w-4', statusColor]" />
        <span :class="['text-sm', statusColor]">
          {{ isValid ? t('mcpCatalog.form.claudeConfig.validConfiguration') : t('mcpCatalog.form.claudeConfig.invalidConfiguration') }}
        </span>
      </div>
    </div>

    <Textarea
      id="claude-config"
      :model-value="modelValue"
      @update:model-value="(value) => $emit('update:modelValue', String(value))"
      :placeholder="t('mcpCatalog.form.claudeConfig.placeholder')"
      class="min-h-[200px] font-mono text-sm"
      :class="{ 'border-destructive': hasError }"
    />

    <div class="flex justify-end">
      <button
        type="button"
        @click="handleFormat"
        class="text-xs text-muted-foreground hover:text-foreground"
      >
        {{ t('mcpCatalog.form.claudeConfig.formatButton') }}
      </button>
    </div>
  </div>
</template>
