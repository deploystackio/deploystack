<script setup lang="ts">
import { computed, type Component } from 'vue'
import { RouterLink } from 'vue-router'

interface Props {
  to: string
  active?: boolean
  icon?: Component
  iconUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  active: false
})

const itemClass = computed(() => [
  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
  props.active
    ? 'bg-secondary text-secondary-foreground font-medium border border-border'
    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground border border-transparent'
])
</script>

<template>
  <RouterLink :to="to" :class="itemClass">
    <img
      v-if="iconUrl"
      :src="iconUrl"
      alt=""
      class="w-5 h-5 object-contain"
    />
    <component
      v-else-if="icon"
      :is="icon"
      class="w-5 h-5"
    />
    <slot />
  </RouterLink>
</template>
