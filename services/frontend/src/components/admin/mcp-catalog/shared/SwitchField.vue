<script setup lang="ts">
import { Switch } from '@/components/ui/switch'

interface Props {
  modelValue: boolean
  id?: string
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const handleChange = (value: boolean) => {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="flex items-center space-x-3">
    <Switch
      :id="props.id"
      :model-value="props.modelValue"
      :disabled="props.disabled"
      @update:model-value="handleChange"
    />
    <span class="text-sm text-gray-700">
      {{ props.modelValue ? 'Yes' : 'No' }}
    </span>
  </div>
</template>
