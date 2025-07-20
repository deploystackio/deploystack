<script setup lang="ts">
import { ref, watch, onMounted, shallowRef, type Component } from 'vue'
import { Tag } from 'lucide-vue-next'

interface Props {
  /** Icon name to load (case-insensitive). Supports all Lucide icon names. */
  name?: string | null
  /** CSS classes for styling the icon */
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  name: null,
  class: 'h-4 w-4'
})

// Use shallowRef for better performance with components
const IconComponent = shallowRef<Component>(Tag)
const isLoading = ref<boolean>(false)

// Global cache to store loaded icons across all instances
const globalIconCache = new Map<string, Component>()

/**
 * Generate icon name variations to try
 */
function getIconVariations(iconName: string): string[] {
  const clean = iconName.trim()

  // Generate different naming patterns
  const variations = [
    clean,                                                          // Exact: "Database"
    clean.toLowerCase(),                                            // Lowercase: "database"
    clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase(),   // PascalCase: "Database"
    clean.charAt(0).toLowerCase() + clean.slice(1),                // camelCase: "database"
  ]

  // Add kebab-case version for compound words
  const kebabCase = clean.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
  if (kebabCase !== clean.toLowerCase()) {
    variations.push(kebabCase) // "shopping-cart"
  }

  // Add space-to-dash version
  const spaceToDash = clean.replace(/\s+/g, '-').toLowerCase()
  if (spaceToDash !== clean.toLowerCase() && !variations.includes(spaceToDash)) {
    variations.push(spaceToDash) // "globe-lock"
  }

  // Add versions without spaces
  const noSpaces = clean.replace(/\s+/g, '').toLowerCase()
  if (noSpaces !== clean.toLowerCase() && !variations.includes(noSpaces)) {
    variations.push(noSpaces) // "globelock"
  }

  // Add Icon suffix versions
  variations.push(clean + 'Icon')                                 // "DatabaseIcon"
  variations.push(`Lucide${clean}`)                               // "LucideDatabase"

  // Remove duplicates and return
  return [...new Set(variations)]
}

/**
 * Load icon with proper error handling and no blocking
 */
async function loadIcon(iconName: string): Promise<void> {
  if (!iconName || iconName.trim() === '') {
    IconComponent.value = Tag
    return
  }

  const trimmedName = iconName.trim()

  // Check global cache first
  if (globalIconCache.has(trimmedName)) {
    const cachedIcon = globalIconCache.get(trimmedName)
    if (cachedIcon) {
      IconComponent.value = cachedIcon
    }
    return
  }

  // Prevent multiple simultaneous loads of the same icon
  if (isLoading.value) return

  isLoading.value = true

  try {
    // Import the entire lucide-vue-next module
    const lucideModule = await import('lucide-vue-next') as Record<string, any>

    // Try different name variations
    const variations = getIconVariations(trimmedName)
    let foundIcon: Component | null = null

    for (const variation of variations) {
      if (lucideModule[variation]) {
        foundIcon = lucideModule[variation] as Component
        break
      }
    }

    if (foundIcon) {
      // Cache the successful result globally
      globalIconCache.set(trimmedName, foundIcon)
      IconComponent.value = foundIcon
    } else {
      // Icon not found, cache and use fallback
      globalIconCache.set(trimmedName, Tag)
      IconComponent.value = Tag
    }
  } catch (error) {
    // Import failed, cache and use fallback
    globalIconCache.set(trimmedName, Tag)
    IconComponent.value = Tag
  } finally {
    isLoading.value = false
  }
}

// Watch for prop changes
watch(() => props.name, (newName: string | null) => {
  if (newName) {
    loadIcon(newName)
  } else {
    IconComponent.value = Tag
  }
}, { immediate: false })

// Load initial icon
onMounted(() => {
  if (props.name) {
    loadIcon(props.name)
  }
})
</script>

<template>
  <component
    :is="IconComponent"
    :class="props.class"
    :data-icon-name="props.name"
    :data-loading="isLoading"
  />
</template>
