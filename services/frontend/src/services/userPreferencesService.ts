// File: services/frontend/src/services/userPreferencesService.ts

import { getEnv } from '@/utils/env'

export interface UserPreferences {
  // Walkthrough preferences
  walkthrough_completed: boolean
  walkthrough_cancelled: boolean
  
  // Notification preferences
  email_notifications_enabled: boolean
  browser_notifications_enabled: boolean
  notification_acknowledgments: string
  
  // Feature preferences
  beta_features_enabled: boolean
  
  // Allow for additional preferences
  [key: string]: string | boolean | number
}

export interface UpdateUserPreferencesInput {
  walkthrough_completed?: boolean
  walkthrough_cancelled?: boolean
  email_notifications_enabled?: boolean
  browser_notifications_enabled?: boolean
  notification_acknowledgments?: string
  beta_features_enabled?: boolean
  [key: string]: string | boolean | number | undefined
}

export interface ApiResponse<T> {
  success: boolean
  preferences?: T
  message?: string
  error?: string
}

export class UserPreferencesService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  /**
   * Get all user preferences
   * Returns user's complete preference object with defaults applied
   */
  static async getUserPreferences(): Promise<UserPreferences> {
    try {
      const response = await fetch(`${this.baseUrl}/api/users/me/preferences`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for authentication cookies
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Failed to fetch user preferences: ${response.status} ${response.statusText}`
        )
      }

      const data: ApiResponse<UserPreferences> = await response.json()
      
      if (!data.success || !data.preferences) {
        throw new Error(data.error || 'Invalid response from server')
      }

      console.log('Successfully fetched user preferences:', data.preferences)
      return data.preferences

    } catch (error) {
      console.error('Error fetching user preferences:', error)
      throw error
    }
  }

  /**
   * Update multiple user preferences at once
   */
  static async updateUserPreferences(updates: UpdateUserPreferencesInput): Promise<UserPreferences> {
    try {
      console.log('Updating user preferences:', updates)

      const response = await fetch(`${this.baseUrl}/api/users/me/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for authentication cookies
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Failed to update user preferences: ${response.status} ${response.statusText}`
        )
      }

      const data: ApiResponse<string> = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update preferences')
      }

      console.log('Successfully updated user preferences:', data.message)
      
      // Return updated preferences by fetching them again
      return await this.getUserPreferences()

    } catch (error) {
      console.error('Error updating user preferences:', error)
      throw error
    }
  }

  /**
   * Set a single user preference
   * Convenience method for updating a single preference value
   */
  static async setUserPreference(key: keyof UpdateUserPreferencesInput, value: string | boolean | number): Promise<UserPreferences> {
    return this.updateUserPreferences({ [key]: value })
  }

  /**
   * Get a specific user preference with fallback default
   */
  static async getUserPreference<T extends string | boolean | number>(
    key: string, 
    defaultValue?: T
  ): Promise<T | null> {
    try {
      const preferences = await this.getUserPreferences()
      const value = preferences[key]
      
      if (value !== undefined && value !== null) {
        return value as T
      }
      
      return defaultValue !== undefined ? defaultValue : null

    } catch (error) {
      console.error(`Error getting user preference '${key}':`, error)
      return defaultValue !== undefined ? defaultValue : null
    }
  }

  /**
   * Walkthrough-specific convenience methods
   */
  
  /**
   * Check if user should see the walkthrough
   * Returns false if user has completed OR cancelled the walkthrough
   */
  static async shouldShowWalkthrough(): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences()
      const completed = preferences.walkthrough_completed || false
      const cancelled = preferences.walkthrough_cancelled || false
      
      // Don't show if either completed or cancelled
      return !completed && !cancelled
    } catch (error) {
      console.error('Error checking walkthrough status:', error)
      return false // Default to not showing on error
    }
  }

  /**
   * Mark walkthrough as completed using the specialized endpoint
   */
  static async completeWalkthrough(): Promise<void> {
    try {
      console.log('Marking walkthrough as completed via API')

      const response = await fetch(`${this.baseUrl}/api/users/me/preferences/walkthrough/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Failed to complete walkthrough: ${response.status} ${response.statusText}`
        )
      }

      const data: ApiResponse<string> = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to complete walkthrough')
      }

      console.log('Successfully completed walkthrough:', data.message)

    } catch (error) {
      console.error('Error completing walkthrough:', error)
      throw error
    }
  }

  /**
   * Mark walkthrough as cancelled using the specialized endpoint
   */
  static async cancelWalkthrough(): Promise<void> {
    try {
      console.log('Marking walkthrough as cancelled via API')

      const response = await fetch(`${this.baseUrl}/api/users/me/preferences/walkthrough/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Failed to cancel walkthrough: ${response.status} ${response.statusText}`
        )
      }

      const data: ApiResponse<string> = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to cancel walkthrough')
      }

      console.log('Successfully cancelled walkthrough:', data.message)

    } catch (error) {
      console.error('Error cancelling walkthrough:', error)
      throw error
    }
  }

  /**
   * Reset walkthrough state (for testing or admin purposes)
   */
  static async resetWalkthrough(): Promise<UserPreferences> {
    return this.updateUserPreferences({
      walkthrough_completed: false,
      walkthrough_cancelled: false
    })
  }

  /**
   * Get walkthrough status using the specialized endpoint
   */
  static async getWalkthroughStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/users/me/preferences/walkthrough/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Failed to get walkthrough status: ${response.status} ${response.statusText}`
        )
      }

      const data: { success: boolean; should_show_walkthrough: boolean; error?: string } = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get walkthrough status')
      }

      return data.should_show_walkthrough

    } catch (error) {
      console.error('Error getting walkthrough status:', error)
      return false // Default to not showing on error
    }
  }

  /**
   * Notification-specific convenience methods
   */

  /**
   * Check if email notifications are enabled
   */
  static async areEmailNotificationsEnabled(): Promise<boolean> {
    const enabled = await this.getUserPreference<boolean>('email_notifications_enabled', true)
    return enabled || false
  }

  /**
   * Enable/disable email notifications
   */
  static async setEmailNotifications(enabled: boolean): Promise<UserPreferences> {
    return this.setUserPreference('email_notifications_enabled', enabled)
  }

  /**
   * Acknowledge a notification using the specialized endpoint
   */
  static async acknowledgeNotification(notificationId: string): Promise<void> {
    try {
      console.log('Acknowledging notification:', notificationId)

      const response = await fetch(`${this.baseUrl}/api/users/me/preferences/notifications/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          notification_id: notificationId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Failed to acknowledge notification: ${response.status} ${response.statusText}`
        )
      }

      const data: ApiResponse<string> = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to acknowledge notification')
      }

      console.log('Successfully acknowledged notification:', data.message)

    } catch (error) {
      console.error('Error acknowledging notification:', error)
      throw error
    }
  }

  /**
   * Check if a notification has been acknowledged
   */
  static async isNotificationAcknowledged(notificationId: string): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences()
      const acknowledged = preferences.notification_acknowledgments || ''
      const acknowledgedList = acknowledged.split(',').filter(id => id.trim().length > 0)
      
      return acknowledgedList.includes(notificationId)
    } catch (error) {
      console.error('Error checking notification acknowledgment:', error)
      return false
    }
  }

  /**
   * Feature-specific convenience methods
   */

  /**
   * Check if beta features are enabled
   */
  static async areBetaFeaturesEnabled(): Promise<boolean> {
    const enabled = await this.getUserPreference<boolean>('beta_features_enabled', false)
    return enabled || false
  }

  /**
   * Enable/disable beta features
   */
  static async setBetaFeatures(enabled: boolean): Promise<UserPreferences> {
    return this.setUserPreference('beta_features_enabled', enabled)
  }
}
