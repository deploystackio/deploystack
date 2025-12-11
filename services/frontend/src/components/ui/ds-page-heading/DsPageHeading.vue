<script setup lang="ts">
interface Props {
  title: string
  description?: string
}

defineProps<Props>()
</script>

<template>
  <header class="relative -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-screen after:border-b after:border-neutral-200">
    <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 lg:gap-10 py-8">
      <!-- Left: Title, description, and optional content -->
      <div class="flex flex-col items-stretch justify-start flex-1 w-full gap-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-[32px] tracking-[-0.79px] font-medium leading-10">
            {{ title }}
          </h1>
          <p v-if="description" class="text-muted-foreground">
            {{ description }}
          </p>
        </div>
        <div v-if="$slots.default" class="text-sm">
          <slot />
        </div>
      </div>

      <!-- Right: Optional action buttons -->
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-3">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
