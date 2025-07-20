<!--
@component DsAlertDescription
@description Description component for DsAlert. Provides consistent styling for alert descriptions.

@example
<DsAlertDescription>This is additional information about the alert.</DsAlertDescription>

@slots
- default: Description content
-->

<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <div :class="cn('text-sm [&_p]:leading-relaxed', props.class)">
    <slot />
  </div>
</template>
