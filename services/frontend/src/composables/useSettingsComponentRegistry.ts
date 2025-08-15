import type { Component } from 'vue'
import type { GlobalSettingGroup, Setting } from '@/components/globalSettings/GlobalSettingsSidebarNav.vue'

export interface SettingsComponentProps {
  group: GlobalSettingGroup
  settings: Setting[]
}

export interface SettingsComponentEvents {
  'settings-updated': [settings: Setting[]]
  'validation-error': [errors: Record<string, string>]
  'connection-tested': [result: { success: boolean; message: string }]
}

export interface SettingsComponentDefinition {
  component: Component
  events?: SettingsComponentEvents
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  props?: Record<string, any>
  description?: string
  author?: string
  version?: string
}

// Global registry for settings components
const componentRegistry = new Map<string, SettingsComponentDefinition>()

/**
 * Register a custom component for a specific settings group
 * @param groupId - The ID of the settings group (e.g., 'github-app', 'smtp')
 * @param definition - Component definition with metadata
 */
export function registerSettingsComponent(
  groupId: string,
  definition: SettingsComponentDefinition
): void {
  componentRegistry.set(groupId, definition)
}

/**
 * Get the registered component for a settings group
 * @param groupId - The ID of the settings group
 * @returns Component definition or null if not found
 */
export function getSettingsComponent(groupId: string): SettingsComponentDefinition | null {
  return componentRegistry.get(groupId) || null
}

/**
 * Check if a custom component is registered for a settings group
 * @param groupId - The ID of the settings group
 * @returns True if a custom component is registered
 */
export function hasCustomComponent(groupId: string): boolean {
  return componentRegistry.has(groupId)
}

/**
 * Get all registered components
 * @returns Map of all registered components
 */
export function getAllRegisteredComponents(): Map<string, SettingsComponentDefinition> {
  return new Map(componentRegistry)
}

/**
 * Unregister a component (useful for testing or dynamic loading)
 * @param groupId - The ID of the settings group
 */
export function unregisterSettingsComponent(groupId: string): boolean {
  return componentRegistry.delete(groupId)
}

/**
 * Clear all registered components (useful for testing)
 */
export function clearAllComponents(): void {
  componentRegistry.clear()
}
