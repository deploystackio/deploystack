<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useEventBus } from '@/composables/useEventBus'
import { useI18n } from 'vue-i18n'

interface Props {
  open: boolean
  targetElement?: string
  step?: number
}

const props = withDefaults(defineProps<Props>(), {
  step: 1
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'next-step': []
}>()

const { t } = useI18n()
const eventBus = useEventBus()
const isOpen = ref(props.open)
const triggerRef = ref<HTMLElement>()
const positionTop = ref('50vh')
const positionLeft = ref('50vw')
const isPositioned = ref(false)  // Track if positioning is complete
let resizeObserver: ResizeObserver | null = null
let repositionTimeout: number | null = null

// Computed positioning styles
const triggerStyles = computed(() => ({
  position: 'fixed' as const,
  top: positionTop.value,
  left: positionLeft.value,
  transform: 'translateX(-50%)',
  zIndex: 10000,
  pointerEvents: 'none' as const,
  // Hide until positioned correctly
  visibility: (isPositioned.value ? 'visible' : 'hidden') as 'visible' | 'hidden',
}))

// Position the trigger element relative to the target using viewport coordinates (updates on scroll)
const positionTrigger = () => {
  if (repositionTimeout) {
    clearTimeout(repositionTimeout)
    repositionTimeout = null
  }
  
  // Don't continue if popover is closed
  if (!props.open) {
    return
  }
  
  repositionTimeout = window.setTimeout(() => {
    repositionTimeout = null
    
    if (props.targetElement) {
      const targetEl = document.getElementById(props.targetElement)
      if (targetEl) {
        let containerRect: DOMRect
        
        if (props.targetElement === 'last-server-item') {
          // For last server item, use the element directly
          containerRect = targetEl.getBoundingClientRect()
        } else {
          // For buttons or other elements, use the element directly
          containerRect = targetEl.getBoundingClientRect()
        }
        
        // Ensure elements are properly rendered (not zero-width)
        if (containerRect.width === 0 || containerRect.height === 0) {
          console.warn(`Container not ready for element: ${props.targetElement}`)
          return // Stop - no infinite retries
        }
        
        // Calculate center position of the container in viewport coordinates
        const containerCenterX = containerRect.left + (containerRect.width / 2)
        const containerBottom = containerRect.bottom
        
        // Position below the element with some spacing
        const targetTop = containerBottom + 20
        
        // Update reactive positioning
        positionTop.value = `${targetTop}px`
        positionLeft.value = `${containerCenterX}px`
        
        // Mark as positioned and NOW open the popover
        isPositioned.value = true
        isOpen.value = true
        
        console.log(`Successfully positioned walkthrough popover for step ${props.step}`)
      } else {
        console.warn(`Target element '${props.targetElement}' not found for walkthrough step ${props.step}`)
        return // Stop - no infinite retries
      }
    }
  }, 100)
}

// Watch for prop changes
watch(() => props.open, (newValue) => {
  if (newValue) {
    // Don't open the popover yet - wait for positioning
    isPositioned.value = false
    
    // Emit walkthrough step opened event
    console.log(`Emitting walkthrough-step-opened for step ${props.step}`)
    eventBus.emit('walkthrough-step-opened', { step: props.step })
    // Note: walkthrough-overlay-show and step-specific events are now emitted after positioning
    
    // Position first, then open popover
    nextTick(() => {
      positionTrigger()
      
      // Emit overlay events AFTER positioning to ensure all components are mounted
      setTimeout(() => {
        console.log(`Emitting walkthrough-overlay-show for step ${props.step} (after positioning)`)
        eventBus.emit('walkthrough-overlay-show')
        
        // Also emit step-specific events with proper timing
        if (props.step === 1) {
          eventBus.emit('walkthrough-step1-active')
        } else if (props.step === 2) {
          eventBus.emit('walkthrough-step2-active')
        }
      }, 50)
    })
  } else {
    // Close immediately when prop becomes false
    isOpen.value = false
    isPositioned.value = false
    
    // Emit walkthrough step closed event
    eventBus.emit('walkthrough-step-closed', { step: props.step })
    eventBus.emit('walkthrough-overlay-hide')
  }
})

// Watch for internal changes and emit
watch(isOpen, (newValue) => {
  emit('update:open', newValue)
  if (!newValue) {
    // Hide when closing internally
    isPositioned.value = false
    
    // Also emit walkthrough events when closed internally
    eventBus.emit('walkthrough-step-closed', { step: props.step })
    eventBus.emit('walkthrough-overlay-hide')
  }
})

// Prevent closing on outside click during walkthrough
const handleOpenChange = (open: boolean) => {
  if (!open) {
    // Don't allow closing via outside click - only via buttons
    return
  }
  isOpen.value = open
}

function closePopover() {
  isOpen.value = false
  // Events will be emitted by the watch above
}

function handleNextStep() {
  if (props.step === 1) {
    // Emit next step event
    eventBus.emit('walkthrough-next-step', { fromStep: 1, toStep: 2 })
    emit('next-step')
    closePopover()
  } else {
    // Final step - finish walkthrough
    console.log('User clicked finish on walkthrough step 2')
    eventBus.emit('walkthrough-finish')
    closePopover()
  }
}

onMounted(() => {
  if (props.open) {
    // Single positioning attempt for initial load
    nextTick(() => {
      positionTrigger()
    })
  }
  
  // Set up ResizeObserver to handle viewport changes
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (isOpen.value) {
        positionTrigger()
      }
    })
    
    // Observe the document body for viewport changes
    resizeObserver.observe(document.body)
  }
  
  // Also listen for window resize and scroll as fallback
  window.addEventListener('resize', positionTrigger)
  window.addEventListener('orientationchange', positionTrigger)
  window.addEventListener('scroll', positionTrigger)
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  
  if (repositionTimeout) {
    clearTimeout(repositionTimeout)
  }
  
  window.removeEventListener('resize', positionTrigger)
  window.removeEventListener('orientationchange', positionTrigger)
  window.removeEventListener('scroll', positionTrigger)
})
</script>

<template>
  <Popover :open="isOpen" @update:open="handleOpenChange">
    <PopoverTrigger asChild>
      <!-- Fixed positioned trigger that will be moved to point to last server -->
      <button 
        ref="triggerRef"
        :style="triggerStyles"
        class="w-1 h-1 opacity-0"
        aria-hidden="true"
      />
    </PopoverTrigger>
    <PopoverContent 
      class="w-80 sm:w-96 md:w-[420px] p-4 bg-white shadow-lg border border-gray-200 rounded-lg relative z-[10001]"
      align="center"
      side="bottom"
      :avoid-collisions="false"
      :close-on-outside-click="false"
    >
      <div class="space-y-3">
        <!-- Header -->
        <div>
          <h3 class="font-semibold text-lg text-gray-900">
            {{ t(`walkthrough.step${props.step}.title`) }}
          </h3>
        </div>
        
        <!-- Content -->
        <div class="text-sm text-gray-700 space-y-2">
          <p>
            {{ t(`walkthrough.step${props.step}.description.line1`) }}
          </p>
          <p>
            {{ t(`walkthrough.step${props.step}.description.line2`) }}
          </p>
        </div>
        
        <!-- Action button -->
        <div class="flex justify-end pt-2">
          <Button size="sm" @click="handleNextStep">
            {{ props.step === 1 ? t('walkthrough.buttons.next') : t('walkthrough.buttons.finish') }}
          </Button>
        </div>
      </div>
      
      <!-- Pointer arrow pointing UP to the installations list -->
      <div 
        class="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45"
      />
    </PopoverContent>
  </Popover>
</template>
