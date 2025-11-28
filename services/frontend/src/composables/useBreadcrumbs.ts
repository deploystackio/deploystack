import { ref, readonly, type DeepReadonly, type Ref } from 'vue'

/**
 * Represents a single breadcrumb item
 */
export interface BreadcrumbItem {
  /** Display text for the breadcrumb */
  label: string
  /** Optional URL - if omitted, renders as current page (not clickable) */
  href?: string
}

// Shared state - persists across component instances
const breadcrumbItems = ref<BreadcrumbItem[]>([])

/**
 * Composable for managing breadcrumb navigation state
 *
 * Usage in views:
 * ```typescript
 * const { setBreadcrumbs } = useBreadcrumbs()
 *
 * // For static pages like Dashboard
 * onMounted(() => {
 *   setBreadcrumbs([{ label: 'Dashboard' }])
 * })
 *
 * // For dynamic pages like team detail
 * watch(team, (teamData) => {
 *   if (teamData) {
 *     setBreadcrumbs([
 *       { label: 'Admin', href: '/admin' },
 *       { label: 'Teams', href: '/admin/teams' },
 *       { label: teamData.name }
 *     ])
 *   }
 * })
 * ```
 */
export function useBreadcrumbs() {
  /**
   * Set the current breadcrumb trail
   * The last item without href is rendered as the current page
   */
  function setBreadcrumbs(items: BreadcrumbItem[]) {
    breadcrumbItems.value = items
  }

  /**
   * Clear all breadcrumbs
   */
  function clearBreadcrumbs() {
    breadcrumbItems.value = []
  }

  return {
    /** Readonly access to current breadcrumbs */
    breadcrumbs: readonly(breadcrumbItems) as DeepReadonly<Ref<BreadcrumbItem[]>>,
    /** Set the breadcrumb trail */
    setBreadcrumbs,
    /** Clear all breadcrumbs */
    clearBreadcrumbs,
  }
}
