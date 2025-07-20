<!--
@component DsAlert
@description A customizable alert component with multiple variants, optional icons, title, and description. Built following DeployStack design principles.

@example
<DsAlert variant="success" title="Success!" description="Your changes have been saved." />

<DsAlert variant="warning">
  <DsAlertTitle>Warning</DsAlertTitle>
  <DsAlertDescription>Please review your settings before continuing.</DsAlertDescription>
</DsAlert>

@props
- variant: Alert style variant ('default' | 'success' | 'warning' | 'error' | 'info')
- title: Optional title text (alternative to DsAlertTitle slot)
- description: Optional description text (alternative to DsAlertDescription slot)
- showIcon: Whether to show the default variant icon
- dismissible: Whether to show a close button
- size: Size variant ('sm' | 'md' | 'lg')

@emits
- dismiss: Emitted when close button is clicked

@slots
- default: Main content area
- title: Custom title content (overrides title prop)
- description: Custom description content (overrides description prop)
- icon: Custom icon (overrides default variant icon)

@accessibility
- Uses proper ARIA attributes for alert semantics
- Screen reader friendly with sr-only labels
- Supports keyboard navigation for dismissible alerts
-->

<script setup lang="ts">
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info, 
  AlertCircle,
  X 
} from 'lucide-vue-next'
import DsAlertTitle from './DsAlertTitle.vue'
import DsAlertDescription from './DsAlertDescription.vue'

export type DsAlertVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground border-border',
        success: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800',
        warning: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800',
        error: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800',
        info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800'
      },
      size: {
        sm: 'px-3 py-2 text-xs',
        md: 'px-4 py-3 text-sm',
        lg: 'px-6 py-4 text-base'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
)

const iconVariants = cva(
  'shrink-0',
  {
    variants: {
      variant: {
        default: 'text-muted-foreground',
        success: 'text-green-600 dark:text-green-400',
        warning: 'text-yellow-600 dark:text-yellow-400',
        error: 'text-red-600 dark:text-red-400',
        info: 'text-blue-600 dark:text-blue-400'
      },
      size: {
        sm: 'h-3 w-3',
        md: 'h-4 w-4',
        lg: 'h-5 w-5'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
)

interface Props {
  variant?: DsAlertVariant
  title?: string
  description?: string
  showIcon?: boolean
  dismissible?: boolean
  size?: VariantProps<typeof alertVariants>['size']
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  showIcon: true,
  dismissible: false,
  size: 'md'
})

const emit = defineEmits<{
  dismiss: []
}>()

const defaultIcons = {
  default: AlertCircle,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info
}

const defaultIcon = computed(() => defaultIcons[props.variant])

const hasTitle = computed(() => props.title)
const hasDescription = computed(() => props.description)
const hasIcon = computed(() => props.showIcon)
const hasContent = computed(() => hasTitle.value || hasDescription.value)

const contentLayout = computed(() => {
  if (hasIcon.value) {
    return 'grid grid-cols-[auto_1fr] gap-3 items-start'
  }
  return 'flex flex-col gap-1'
})

const contentLayoutWithDismiss = computed(() => {
  if (props.dismissible) {
    if (hasIcon.value) {
      return 'grid grid-cols-[auto_1fr_auto] gap-3 items-start'
    }
    return 'flex justify-between items-start gap-3'
  }
  return contentLayout.value
})

function handleDismiss() {
  emit('dismiss')
}
</script>

<template>
  <div
    role="alert"
    :class="cn(alertVariants({ variant, size }))"
  >
    <div :class="contentLayoutWithDismiss">
      <!-- Icon -->
      <div v-if="hasIcon" class="mt-0.5">
        <slot name="icon">
          <component 
            :is="defaultIcon" 
            :class="cn(iconVariants({ variant, size }))"
          />
        </slot>
      </div>

      <!-- Content -->
      <div class="flex-1 space-y-1">
        <!-- Title -->
        <div v-if="hasTitle || $slots.title">
          <slot name="title">
            <DsAlertTitle v-if="title">{{ title }}</DsAlertTitle>
          </slot>
        </div>

        <!-- Description -->
        <div v-if="hasDescription || $slots.description">
          <slot name="description">
            <DsAlertDescription v-if="description">{{ description }}</DsAlertDescription>
          </slot>
        </div>

        <!-- Default slot for custom content -->
        <div v-if="$slots.default && !hasContent">
          <slot />
        </div>
      </div>

      <!-- Dismiss button -->
      <button
        v-if="dismissible"
        type="button"
        :class="[
          'shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:pointer-events-none',
          size === 'sm' ? 'h-3 w-3 mt-0.5' : '',
          size === 'md' ? 'h-4 w-4 mt-0.5' : '',
          size === 'lg' ? 'h-5 w-5 mt-0.5' : ''
        ]"
        @click="handleDismiss"
      >
        <span class="sr-only">Close</span>
        <X :class="size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'" />
      </button>
    </div>
  </div>
</template>
