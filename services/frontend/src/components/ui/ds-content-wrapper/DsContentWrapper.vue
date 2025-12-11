<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { ContentWrapperVariants } from "."
import { cn } from "@/lib/utils"
import { contentWrapperVariants } from "."

interface Props {
  maxWidth?: ContentWrapperVariants["maxWidth"]
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  maxWidth: "xl",
})
</script>

<template>
  <div
    data-slot="content-wrapper"
    :class="cn(contentWrapperVariants({ maxWidth }), props.class)"
  >
    <slot />
  </div>
</template>
