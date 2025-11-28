<!--
@component DsTabsItem
@description Individual tab item component for use within DsTabs. Provides a slot-based API for flexible tab content.

@example
<DsTabsItem value="account" label="My Account">
  <User class="h-4 w-4" />
</DsTabsItem>

<DsTabsItem value="settings" label="Settings" badge="2" disabled />

@props
- value: Unique identifier for this tab
- label: Display text for the tab
- href: Optional URL for navigation (creates link instead of button)
- disabled: Whether this tab is disabled
- badge: Optional badge content (string or number)

@slots
- default: Content to display alongside the label (typically icons)
- badge: Custom badge content (overrides badge prop)

@accessibility
- Automatically integrates with parent DsTabs accessibility features
- Supports keyboard navigation when used within DsTabs
- Proper ARIA attributes inherited from parent
-->

<script setup lang="ts">
import { inject, onMounted, onUnmounted, computed } from 'vue'
import type { DsTabItem } from './DsTabs.vue'

interface Props {
  value: string
  label: string
  href?: string
  disabled?: boolean
  badge?: string | number
}

const props = defineProps<Props>()

// Inject context from parent DsTabs
const tabsContext = inject('ds-tabs', null) as any

if (!tabsContext) {
  console.warn('DsTabsItem must be used within DsTabs component')
}

const tabData = computed<DsTabItem>(() => ({
  value: props.value,
  label: props.label,
  href: props.href,
  disabled: props.disabled,
  badge: props.badge
}))

const isActive = computed(() =>
  tabsContext?.activeTab?.value === props.value
)

const isDisabled = computed(() =>
  props.disabled || tabsContext?.disabled
)

function handleClick(event: Event) {
  if (isDisabled.value) {
    event.preventDefault()
    return
  }

  if (props.href) {
    // Let the browser handle navigation
    return
  }

  event.preventDefault()
  if (tabsContext) {
    tabsContext.activeTab.value = props.value
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    handleClick(event)
  }
}

// Register/unregister with parent
onMounted(() => {
  if (tabsContext) {
    tabsContext.registerTab(tabData.value)
  }
})

onUnmounted(() => {
  if (tabsContext) {
    tabsContext.unregisterTab(props.value)
  }
})

// Generate classes based on parent context
const tabClasses = computed(() => {
  if (!tabsContext) return ''

  const { variant, size } = tabsContext
  const baseClasses = []

  // Size classes
  switch (size) {
    case 'sm':
      baseClasses.push('px-2 py-1 text-xs font-medium')
      break
    case 'lg':
      baseClasses.push('px-6 py-3 text-base font-medium')
      break
    default:
      baseClasses.push('px-3 py-2 text-sm font-medium')
  }

  // Base interaction classes
  baseClasses.push(
    'inline-flex items-center gap-2 transition-colors',
    'focus:outline-none',
    'disabled:cursor-not-allowed disabled:opacity-50'
  )

  // Variant classes
  switch (variant) {
    case 'underlined':
      // Override size padding for underlined variant
      baseClasses.length = 0
      baseClasses.push(
        'px-1 py-4 text-sm font-medium whitespace-nowrap',
        'inline-flex items-center gap-2 transition-colors',
        'focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'border-b-2',
        isActive.value
          ? '!border-zinc-950 text-foreground dark:!border-zinc-50'
          : '!border-transparent text-muted-foreground hover:text-foreground hover:!border-border'
      )
      break
    case 'pills':
      baseClasses.push(
        'rounded-md transition-colors',
        isActive.value
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )
      break
    case 'bordered':
      baseClasses.push(
        'rounded-md transition-colors',
        isActive.value
          ? 'bg-white text-foreground shadow-sm border border-border'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )
      break
    default:
      baseClasses.push(
        'rounded-md transition-colors',
        isActive.value
          ? 'bg-primary text-white border border-primary'
          : 'bg-white text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
      )
  }

  return baseClasses.join(' ')
})

const iconClasses = computed(() => {
  if (!tabsContext) return 'h-4 w-4'

  switch (tabsContext.size) {
    case 'sm': return 'h-3 w-3'
    case 'lg': return 'h-5 w-5'
    default: return 'h-4 w-4'
  }
})

const badgeClasses = computed(() => {
  if (!tabsContext) return ''

  const baseClasses = ['rounded-full px-2 py-0.5 text-xs font-medium']

  switch (tabsContext.variant) {
    case 'pills':
      baseClasses.push(
        isActive.value
          ? 'bg-primary-foreground text-primary'
          : 'bg-muted text-muted-foreground'
      )
      break
    default:
      baseClasses.push(
        isActive.value
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground'
      )
  }

  return baseClasses.join(' ')
})
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    role="tab"
    :tabindex="isActive ? 0 : -1"
    :aria-selected="isActive"
    :aria-current="isActive ? 'page' : undefined"
    :disabled="isDisabled"
    :class="tabClasses"
    @click="handleClick"
    @keydown="handleKeyDown"
  >
    <span v-if="$slots.default" :class="iconClasses">
      <slot />
    </span>
    {{ label }}
    <span v-if="badge || $slots.badge" :class="badgeClasses">
      <slot name="badge">{{ badge }}</slot>
    </span>
  </component>
</template>
