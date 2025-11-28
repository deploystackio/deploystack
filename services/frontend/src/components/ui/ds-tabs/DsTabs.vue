<!--
@component DsTabs
@description A responsive tabs component with mobile dropdown and desktop navigation. Built following DeployStack design principles with full accessibility support.

@example
<DsTabs v-model="activeTab" :tabs="tabs" />

<DsTabs v-model="activeTab">
  <DsTabsItem value="account" label="My Account" />
  <DsTabsItem value="company" label="Company" />
  <DsTabsItem value="team" label="Team Members" />
</DsTabs>

@props
- modelValue: Current active tab value
- tabs: Array of tab objects with { value, label, href?, disabled?, badge? }
- variant: Visual style variant ('default' | 'underlined' | 'pills' | 'bordered')
- size: Size variant ('sm' | 'md' | 'lg')
- fullWidth: Whether tabs should take full width
- justified: Whether tabs should be evenly distributed
- disabled: Whether the entire tab group is disabled

@emits
- update:modelValue: Emitted when active tab changes
- tabChange: Emitted with detailed tab info

@slots
- default: DsTabsItem components (alternative to tabs prop)

@accessibility
- Uses proper ARIA attributes for tab navigation
- Supports keyboard navigation (arrow keys, tab, enter, space)
- Mobile-friendly with select dropdown
- Screen reader friendly with proper labeling
-->

<script setup lang="ts">
import { computed, ref, provide } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-vue-next'

export interface DsTabItem {
  value: string
  label: string
  href?: string
  disabled?: boolean
  badge?: string | number
  icon?: any
}

export type DsTabsVariant = 'default' | 'underlined' | 'pills' | 'bordered'

const tabsVariants = cva(
  'relative',
  {
    variants: {
      variant: {
        default: 'py-8',
        underlined: '',
        pills: 'py-8',
        bordered: 'py-8 border border-border rounded-lg p-1'
      },
      size: {
        sm: '',
        md: '',
        lg: ''
      },
      fullWidth: {
        true: 'w-full',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      fullWidth: false
    }
  }
)

const tabListVariants = cva(
  'flex',
  {
    variants: {
      variant: {
        default: 'space-x-1',
        underlined: '-mb-px space-x-8',
        pills: 'space-x-1',
        bordered: 'space-x-1'
      },
      justified: {
        true: 'justify-between w-full',
        false: ''
      },
      fullWidth: {
        true: '[&>*]:flex-1',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      justified: false,
      fullWidth: false
    }
  }
)

const selectVariants = cva(
  'w-full appearance-none rounded-md border px-3 py-2 text-base outline-none transition-colors',
  {
    variants: {
      size: {
        sm: 'py-1.5 px-2 text-sm',
        md: 'py-2 px-3 text-base',
        lg: 'py-2.5 px-4 text-lg'
      }
    },
    defaultVariants: {
      size: 'md'
    }
  }
)

interface Props {
  modelValue?: string
  tabs?: DsTabItem[]
  variant?: DsTabsVariant
  size?: VariantProps<typeof tabsVariants>['size']
  fullWidth?: boolean
  justified?: boolean
  disabled?: boolean
  mobileBreakpoint?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
  fullWidth: false,
  justified: false,
  disabled: false,
  mobileBreakpoint: 'sm'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  tabChange: [tab: DsTabItem]
}>()

// For slot-based tabs
const slotTabs = ref<DsTabItem[]>([])

// Computed tabs from props or slots
const computedTabs = computed(() => {
  if (props.tabs && props.tabs.length > 0) {
    return props.tabs
  }
  return slotTabs.value
})

const activeTab = computed({
  get: () => props.modelValue,
  set: (value: string | undefined) => {
    if (value && !props.disabled) {
      emit('update:modelValue', value)
      const tab = computedTabs.value.find(t => t.value === value)
      if (tab) {
        emit('tabChange', tab)
      }
    }
  }
})

const currentTab = computed(() => 
  computedTabs.value.find(tab => tab.value === activeTab.value)
)

const breakpointClass = computed(() => {
  switch (props.mobileBreakpoint) {
    case 'sm': return 'sm:hidden'
    case 'md': return 'md:hidden'
    case 'lg': return 'lg:hidden'
    default: return 'sm:hidden'
  }
})

const desktopBreakpointClass = computed(() => {
  switch (props.mobileBreakpoint) {
    case 'sm': return 'hidden sm:block'
    case 'md': return 'hidden md:block'
    case 'lg': return 'hidden lg:block'
    default: return 'hidden sm:block'
  }
})

function handleTabClick(tab: DsTabItem, event: Event) {
  if (tab.disabled || props.disabled) {
    event.preventDefault()
    return
  }
  
  if (tab.href) {
    // Let the browser handle the navigation
    return
  }
  
  event.preventDefault()
  activeTab.value = tab.value
}

function handleSelectChange(event: Event) {
  const target = event.target as HTMLSelectElement
  activeTab.value = target.value
}

function handleKeyDown(event: KeyboardEvent, tab: DsTabItem) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    handleTabClick(tab, event)
  }
}

// Helper methods for styling
function getTabClasses(tab: DsTabItem) {
  const isActive = tab.value === activeTab.value
  const baseClasses = []
  
  // Size classes
  switch (props.size) {
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
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50'
  )
  
  // Variant classes
  switch (props.variant) {
    case 'underlined':
      // Override size padding for underlined variant
      baseClasses.length = 0
      baseClasses.push(
        'px-1 py-4 text-sm font-medium whitespace-nowrap',
        'inline-flex items-center gap-2 transition-colors',
        'focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'border-b-2',
        isActive
          ? '!border-zinc-950 text-foreground dark:!border-zinc-50'
          : '!border-transparent text-muted-foreground hover:text-foreground hover:!border-border'
      )
      break
    case 'pills':
      baseClasses.push(
        'rounded-md transition-colors',
        isActive 
          ? 'bg-primary text-primary-foreground' 
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )
      break
    case 'bordered':
      baseClasses.push(
        'rounded-md transition-colors',
        isActive 
          ? 'bg-background text-foreground shadow-sm border border-border' 
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )
      break
    default:
      baseClasses.push(
        'rounded-md transition-colors',
        isActive 
          ? 'bg-muted text-foreground' 
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      )
  }
  
  return baseClasses.join(' ')
}

function getIconClasses() {
  switch (props.size) {
    case 'sm': return 'h-3 w-3'
    case 'lg': return 'h-5 w-5'
    default: return 'h-4 w-4'
  }
}

function getBadgeClasses(tab: DsTabItem) {
  const isActive = tab.value === activeTab.value
  
  switch (props.variant) {
    case 'pills':
      return isActive 
        ? 'bg-primary-foreground text-primary' 
        : 'bg-muted text-muted-foreground'
    default:
      return isActive 
        ? 'bg-primary text-primary-foreground' 
        : 'bg-muted text-muted-foreground'
  }
}

// Provide context for child components using getters for reactivity
provide('ds-tabs', {
  activeTab,
  get variant() { return props.variant },
  get size() { return props.size },
  get disabled() { return props.disabled },
  registerTab: (tab: DsTabItem) => {
    if (!slotTabs.value.find(t => t.value === tab.value)) {
      slotTabs.value.push(tab)
    }
  },
  unregisterTab: (value: string) => {
    const index = slotTabs.value.findIndex(t => t.value === value)
    if (index > -1) {
      slotTabs.value.splice(index, 1)
    }
  }
})
</script>

<template>
  <div :class="cn(tabsVariants({ variant, size, fullWidth }))">
    <!-- Mobile dropdown -->
    <div :class="['relative', breakpointClass]">
      <select
        :value="activeTab"
        :disabled="disabled"
        :class="cn(
          selectVariants({ size }),
          'bg-background border-border text-foreground',
          'focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )"
        aria-label="Select a tab"
        @change="handleSelectChange"
      >
        <option
          v-for="tab in computedTabs"
          :key="tab.value"
          :value="tab.value"
          :disabled="tab.disabled"
          :selected="tab.value === activeTab"
        >
          {{ tab.label }}
          <span v-if="tab.badge">{{ ` (${tab.badge})` }}</span>
        </option>
      </select>
      <ChevronDown 
        :class="[
          'pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground',
          size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
        ]" 
        aria-hidden="true" 
      />
    </div>

    <!-- Desktop navigation -->
    <div :class="[desktopBreakpointClass, variant === 'underlined' ? 'border-b border-border' : '']">
      <nav
        role="tablist"
        :class="cn(tabListVariants({ variant, justified, fullWidth }))"
        aria-label="Tabs"
      >
        <slot>
          <!-- Render tabs from props if no slots provided -->
          <component
            v-for="tab in computedTabs"
            :key="tab.value"
            :is="tab.href ? 'a' : 'button'"
            :href="tab.href"
            role="tab"
            :tabindex="tab.value === activeTab ? 0 : -1"
            :aria-selected="tab.value === activeTab"
            :aria-current="tab.value === activeTab ? 'page' : undefined"
            :disabled="tab.disabled || disabled"
            :class="[
              'inline-flex items-center gap-2 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              getTabClasses(tab)
            ]"
            @click="handleTabClick(tab, $event)"
            @keydown="handleKeyDown($event, tab)"
          >
            <component v-if="tab.icon" :is="tab.icon" :class="getIconClasses()" />
            {{ tab.label }}
            <span
              v-if="tab.badge"
              :class="[
                'rounded-full px-2 py-0.5 text-xs font-medium',
                getBadgeClasses(tab)
              ]"
            >
              {{ tab.badge }}
            </span>
          </component>
        </slot>
      </nav>
    </div>
  </div>
</template>
