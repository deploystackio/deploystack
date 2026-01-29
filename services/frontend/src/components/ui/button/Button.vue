<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from "."
import { Primitive } from "reka-ui"
import { cn } from "@/lib/utils"
import { buttonVariants } from "."
import { Spinner } from "@/components/ui/spinner"

interface Props extends PrimitiveProps {
  variant?: ButtonVariants["variant"]
  size?: ButtonVariants["size"]
  class?: HTMLAttributes["class"]
  loading?: boolean
  loadingText?: string
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  loading: false,
})
</script>

<template>
  <Primitive
    data-slot="button"
    :as="as"
    :as-child="asChild"
    :disabled="loading"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <Spinner v-if="loading" class="mr-2" />
    <slot v-if="!loadingText || !loading" />
    <span v-else>{{ loadingText }}</span>
  </Primitive>
</template>
