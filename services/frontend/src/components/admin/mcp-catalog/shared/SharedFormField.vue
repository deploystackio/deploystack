<script setup lang="ts">
interface Props {
  label: string
  description?: string
  required?: boolean
}

defineProps<Props>()
</script>

<template>
  <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
    <dt class="text-sm/6 font-medium text-gray-900">
      {{ label }}
      <span v-if="required" class="text-red-500 ml-1">*</span>
    </dt>
    <dd class="mt-1 sm:col-span-2 sm:mt-0">
      <slot />
      <p v-if="description" class="text-xs text-muted-foreground mt-1">
        {{ description }}
      </p>
    </dd>
  </div>
</template>
