<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  iconUrl?: string | null
  serverName?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | number
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  rounded: 'md'
})

const imageError = ref(false)

const sizeClasses = computed(() => {
  if (typeof props.size === 'number') {
    return ''
  }

  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-20 w-20'
  }

  return sizeMap[props.size]
})

const customSize = computed(() => {
  if (typeof props.size === 'number') {
    return {
      width: `${props.size}px`,
      height: `${props.size}px`
    }
  }
  return undefined
})

const roundedClasses = computed(() => {
  const roundedMap = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  }

  return roundedMap[props.rounded]
})

const fontSizeClasses = computed(() => {
  if (typeof props.size === 'number') {
    // For custom pixel sizes, font size is handled by customFontSize style
    return ''
  }

  const fontSizeMap = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-3xl',
    xl: 'text-4xl'
  }

  return fontSizeMap[props.size]
})

const customFontSize = computed(() => {
  if (typeof props.size === 'number') {
    const fontSize = Math.floor(props.size * 0.5)
    return {
      fontSize: `${fontSize}px`
    }
  }
  return undefined
})

const showImage = computed(() => {
  return props.iconUrl && !imageError.value
})

const firstLetter = computed(() => {
  if (!props.serverName) return '?'
  return props.serverName.charAt(0).toUpperCase()
})

const handleImageError = () => {
  imageError.value = true
}
</script>

<template>
  <!-- Show image if iconUrl exists and hasn't errored -->
  <img
    v-if="showImage"
    :src="iconUrl!"
    :alt="serverName ? `${serverName} avatar` : 'MCP server avatar'"
    :class="[sizeClasses, roundedClasses, 'shrink-0']"
    :style="customSize"
    @error="handleImageError"
  />

  <!-- Show letter badge fallback if no iconUrl or image error -->
  <div
    v-else
    :class="[
      sizeClasses,
      roundedClasses,
      fontSizeClasses,
      'shrink-0',
      'bg-teal-700',
      'text-white',
      'font-bold',
      'flex',
      'items-center',
      'justify-center',
      'select-none'
    ]"
    :style="{ ...customSize, ...customFontSize, lineHeight: '1' }"
    :aria-label="serverName ? `${serverName} avatar` : 'MCP server avatar'"
  >
    {{ firstLetter }}
  </div>
</template>
