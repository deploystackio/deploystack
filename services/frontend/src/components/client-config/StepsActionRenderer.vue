<script setup lang="ts">
import type { StepsAction } from '@/services/satelliteConfigService'

interface Props {
  action: StepsAction
}

defineProps<Props>()
</script>

<template>
  <div class="space-y-4">
    <ol class="space-y-3 list-none">
      <li v-for="(step, index) in action.steps" :key="index" class="flex gap-3">
        <span class="shrink-0 font-semibold text-sm">{{ index + 1 }}.</span>
        <div class="flex-1 space-y-1">
          <div class="font-medium text-sm">{{ step.name }}</div>
          <div class="text-sm text-muted-foreground">{{ step.content }}</div>
        </div>
      </li>
    </ol>
  </div>
</template>
