<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: number
  max?: number
}

const props = withDefaults(defineProps<Props>(), {
  max: 100
})

const percentage = computed(() => {
  return Math.min(Math.max(props.modelValue, 0), props.max)
})

const progressPercentage = computed(() => {
  return (percentage.value / props.max) * 100
})
</script>

<template>
  <div class="relative w-full overflow-hidden rounded-full bg-secondary h-2">
    <div
      class="h-full bg-primary transition-all duration-300 ease-in-out"
      :style="{ width: `${progressPercentage}%` }"
    />
  </div>
</template>
