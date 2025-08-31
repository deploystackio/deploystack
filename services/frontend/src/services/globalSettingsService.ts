import { getEnv } from '@/utils/env'
import { UserPreferencesService } from './userPreferencesService'

/**
 * Service for fetching global settings
 */
export class GlobalSettingsService {
  private static readonly API_BASE = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  /**
   * Get a specific global setting value
   */
  static async getSetting(key: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.API_BASE}/api/settings/${encodeURIComponent(key)}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null // Setting doesn't exist
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data.data?.value || null
    } catch (error) {
      console.error(`Failed to fetch global setting "${key}":`, error)
      return null // Return null on error to gracefully handle missing settings
    }
  }

  /**
   * Get the MCP catalog banner visibility setting
   */
  static async shouldShowMcpCatalogBanner(): Promise<boolean> {
    try {
      const value = await this.getSetting('global.show_mcp_catalog_banner')
      // Convert string to boolean - 'true' becomes true, anything else becomes false
      return value === 'true'
    } catch (error) {
      console.error('Failed to check MCP catalog banner setting:', error)
      return false // Default to not showing banner on error
    }
  }

  /**
   * Get the user walkthrough visibility setting
   * Uses user preferences for proper permissions (no 403 errors for normal users)
   */
  static async shouldShowUserWalkthrough(): Promise<boolean> {
    try {
      // Use UserPreferencesService for consistent architecture and proper permissions
      return await UserPreferencesService.shouldShowWalkthrough()
    } catch (error) {
      console.error('Failed to check user walkthrough setting:', error)
      return false // Default to not showing walkthrough on error
    }
  }
}
