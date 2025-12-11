<script setup lang="ts">
interface Props {
  title?: string
}

defineProps<Props>()
</script>

<template>
  <div class="space-y-2">
    <h3 v-if="title" class="font-semibold text-sm text-foreground pl-3">
      {{ title }}
    </h3>
    <nav class="space-y-1">
      <slot />
    </nav>
  </div>
</template>
