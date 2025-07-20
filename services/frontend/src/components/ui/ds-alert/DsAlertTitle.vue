<!--
@component DsAlertTitle
@description Title component for DsAlert. Provides consistent styling for alert titles.

@example
<DsAlertTitle>Important Notice</DsAlertTitle>

@slots
- default: Title content
-->

<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <h5 :class="cn('mb-1 font-medium leading-none tracking-tight', props.class)">
    <slot />
  </h5>
</template>
