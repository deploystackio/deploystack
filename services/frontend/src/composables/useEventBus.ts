/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject } from 'vue'
import type { Emitter } from 'mitt'

export type EventBusEvents = {
  'teams-updated': void
  'team-created': void
  'team-deleted': void
  'team-selected': { teamId: string; teamName: string }
  'credentials-updated': void
  'credential-created': { credentialId: string; credentialName: string }
  'credential-deleted': { credentialId: string; credentialName: string }
  'mcp-catalog-updated': void
  'mcp-server-created': void
  'mcp-server-updated': { serverId: string }
  'mcp-server-deleted': { serverId: string }
  'mcp-categories-updated': void
  'mcp-category-created': void
  'mcp-category-updated': { categoryId: string }
  'mcp-category-deleted': { categoryId: string }
  'mcp-installations-updated': void
  'mcp-server-installed': { serverId: string; installationId: string }
  'mcp-installation-removed': { installationId: string }
  'mcp-install-wizard-reset': void
  'notification-show': { message: string; type: string; [key: string]: any }
  'mcp-form-data-updated': { step: number; data: any }
  'mcp-add-form-data-updated': { step: number; data: any }
  'mcp-form-data-loaded': { formData: any; currentStep: number }
  'mcp-form-data-cleared': void
  'mcp-github-data-populated': any
  'mcp-form-step-changed': { from: number; to: number; stepKey: string }
  'technical-env-vars-updated': { envVars: string[] }

  'mcp-edit-draft-updated': { serverId: string; data: any; step: number }
  'mcp-edit-draft-cleared': { serverId: string }
  'icons-cache-loaded': { count: number }
  'icons-cache-error': { message: string }
  'icons-cache-cleared': void
  'settings-updated': void
  'settings-group-updated': { groupId: string }
  'settings-connection-tested': { groupId: string; success: boolean; message: string }
  'storage-changed': { key: string; oldValue: any; newValue: any }
}

// Storage configuration
const STORAGE_CONFIG = {
  prefix: 'deploystack_',
  keys: {
    SELECTED_TEAM_ID: 'selected_team_id',
  }
}

// Enhanced event bus with storage capabilities
interface EnhancedEventBus extends Emitter<EventBusEvents> {
  setState<T>(key: string, value: T): void
  getState<T>(key: string, defaultValue?: T): T | null
  clearState(key: string): void
  hasState(key: string): boolean
  getAllState(): Record<string, any>
  clearAllState(): void
}

// Storage utility functions
function getStorageKey(key: string): string {
  return `${STORAGE_CONFIG.prefix}${key}`
}

function safeJsonParse<T>(value: string | null, defaultValue?: T): T | null {
  if (value === null) return defaultValue ?? null
  try {
    return JSON.parse(value)
  } catch {
    return defaultValue ?? null
  }
}


function safeJsonStringify(value: any): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function useEventBus(): EnhancedEventBus {
  const emitter = inject<Emitter<EventBusEvents>>('emitter')
  if (!emitter) {
    throw new Error('Event bus not provided. Make sure to provide the emitter in main.ts')
  }

  // Add storage methods to the emitter
  const enhancedEmitter = emitter as EnhancedEventBus

  // Set state in localStorage
  enhancedEmitter.setState = function<T>(key: string, value: T): void {
    const storageKey = getStorageKey(key)
    const oldValue = safeJsonParse(localStorage.getItem(storageKey))

    try {
      localStorage.setItem(storageKey, safeJsonStringify(value))

      // Emit storage change event
      this.emit('storage-changed', { key, oldValue, newValue: value })
    } catch (error) {
      console.error(`Failed to set storage for key "${key}":`, error)
    }
  }

  // Get state from localStorage
  enhancedEmitter.getState = function<T>(key: string, defaultValue?: T): T | null {
    const storageKey = getStorageKey(key)

    try {
      const value = localStorage.getItem(storageKey)
      return safeJsonParse<T>(value, defaultValue)
    } catch (error) {
      console.error(`Failed to get storage for key "${key}":`, error)
      return defaultValue ?? null
    }
  }

  // Clear specific state
  enhancedEmitter.clearState = function(key: string): void {
    const storageKey = getStorageKey(key)
    const oldValue = safeJsonParse(localStorage.getItem(storageKey))

    try {
      localStorage.removeItem(storageKey)

      // Emit storage change event
      this.emit('storage-changed', { key, oldValue, newValue: null })
    } catch (error) {
      console.error(`Failed to clear storage for key "${key}":`, error)
    }
  }

  // Check if state exists
  enhancedEmitter.hasState = function(key: string): boolean {
    const storageKey = getStorageKey(key)

    try {
      return localStorage.getItem(storageKey) !== null
    } catch (error) {
      console.error(`Failed to check storage for key "${key}":`, error)
      return false
    }
  }

  // Get all stored state
  
  enhancedEmitter.getAllState = function(): Record<string, any> {
    
    const result: Record<string, any> = {}

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(STORAGE_CONFIG.prefix)) {
          const cleanKey = key.replace(STORAGE_CONFIG.prefix, '')
          const value = localStorage.getItem(key)
          result[cleanKey] = safeJsonParse(value)
        }
      }
    } catch (error) {
      console.error('Failed to get all storage:', error)
    }

    return result
  }

  // Clear all stored state
  enhancedEmitter.clearAllState = function(): void {
    try {
      const keysToRemove: string[] = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(STORAGE_CONFIG.prefix)) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => {
        const cleanKey = key.replace(STORAGE_CONFIG.prefix, '')
        const oldValue = safeJsonParse(localStorage.getItem(key))
        localStorage.removeItem(key)

        // Emit storage change event for each cleared key
        this.emit('storage-changed', { key: cleanKey, oldValue, newValue: null })
      })
    } catch (error) {
      console.error('Failed to clear all storage:', error)
    }
  }

  return enhancedEmitter
}
