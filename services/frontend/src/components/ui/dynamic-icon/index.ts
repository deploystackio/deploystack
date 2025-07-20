// Export the main working component
export { default as DynamicIcon } from './DynamicIcon.vue'

// Export types for TypeScript support
export interface DynamicIconProps {
  /** Icon name to load (case-insensitive). Supports all Lucide icon names. */
  name?: string | null
  /** CSS classes for styling the icon */
  class?: string
}
