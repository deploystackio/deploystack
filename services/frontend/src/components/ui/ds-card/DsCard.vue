<script setup lang="ts">
interface Props {
  title: string
}

defineProps<Props>()
</script>

<template>
  <div class="rounded-lg border border-neutral-200 bg-white mb-8 last:mb-0">
    <!-- Content Area -->
    <div class="p-6">
      <h4 class="text-xl font-medium leading-8 tracking-tight text-foreground">
        {{ title }}
      </h4>
      <div v-if="$slots.default" class="mt-4">
        <slot />
      </div>
    </div>

    <!-- Footer -->
    <footer
      v-if="$slots['footer-status'] || $slots['footer-actions']"
      class="flex items-center justify-between gap-4 border-t border-neutral-200 bg-neutral-50 px-6 py-4"
    >
      <div v-if="$slots['footer-status']" class="text-sm text-muted-foreground">
        <slot name="footer-status" />
      </div>
      <div v-else />
      <div v-if="$slots['footer-actions']" class="flex items-center gap-2">
        <slot name="footer-actions" />
      </div>
    </footer>
  </div>
</template>
