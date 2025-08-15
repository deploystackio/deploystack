import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AnyDatabase } from '../db/index';
import { userPreferences } from '../db/schema.sqlite';
import { 
  DEFAULT_USER_PREFERENCES, 
  getDefaultPreferencesArray, 
  isValidPreferenceKey, 
  isValidPreferenceValue,
  type PreferenceValue
} from '../config/user-preferences';

// TypeScript interfaces for structured preferences (for backward compatibility)
export interface WalkthroughPreferences {
  completed?: boolean;
  cancelled?: boolean;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
}

export interface NotificationPreferences {
  email_enabled?: boolean;
  browser_enabled?: boolean;
  acknowledgments?: string[];
}

export interface UIPreferences {
  theme?: 'light' | 'dark' | 'auto';
  sidebar_collapsed?: boolean;
  dashboard_layout?: string[];
}

export interface FeaturePreferences {
  beta_features_enabled?: boolean;
  experimental_features?: string[];
}

// Main preferences interface - now represents the flattened key-value structure
export interface UserPreferences {
  [key: string]: PreferenceValue;
}

export class UserPreferencesService {
  constructor(private db: AnyDatabase) {}

  /**
   * Initialize default preferences for a new user
   * This should be called during user registration
   */
  async initializeUserPreferences(userId: string): Promise<void> {
    const defaultPreferences = getDefaultPreferencesArray();
    
    // Insert all default preferences for the new user
    const preferencesToInsert = defaultPreferences.map(({ key, value }) => ({
      id: nanoid(),
      user_id: userId,
      preference_key: key,
      preference_value: String(value), // Store all values as strings
      created_at: new Date(),
      updated_at: new Date(),
    }));

    // Use batch insert for better performance
    if (preferencesToInsert.length > 0) {
      await this.db.insert(userPreferences).values(preferencesToInsert);
    }
  }

  /**
   * Get all preferences for a user as a flat key-value object
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const preferences = await this.db
      .select({
        key: userPreferences.preference_key,
        value: userPreferences.preference_value,
      })
      .from(userPreferences)
      .where(eq(userPreferences.user_id, userId));

    const result: UserPreferences = {};
    
    for (const pref of preferences) {
      // Convert string values back to their original types
      result[pref.key] = this.parsePreferenceValue(pref.key, pref.value);
    }

    return result;
  }

  /**
   * Get a specific preference by key
   */
  async getPreference<T extends PreferenceValue>(
    userId: string, 
    key: string, 
    defaultValue?: T
  ): Promise<T | undefined> {
    const preference = await this.db
      .select({ value: userPreferences.preference_value })
      .from(userPreferences)
      .where(
        and(
          eq(userPreferences.user_id, userId),
          eq(userPreferences.preference_key, key)
        )
      )
      .get();

    if (!preference) {
      return defaultValue;
    }

    return this.parsePreferenceValue(key, preference.value) as T;
  }

  /**
   * Set a specific preference
   */
  async setPreference(userId: string, key: string, value: PreferenceValue): Promise<void> {
    // Validate the preference key and value
    if (!isValidPreferenceKey(key)) {
      throw new Error(`Invalid preference key: ${key}`);
    }

    if (!isValidPreferenceValue(key, value)) {
      throw new Error(`Invalid value type for preference key: ${key}`);
    }

    const stringValue = String(value);
    const now = new Date();

    // Try to update existing preference first
    const result = await this.db
      .update(userPreferences)
      .set({
        preference_value: stringValue,
        updated_at: now,
      })
      .where(
        and(
          eq(userPreferences.user_id, userId),
          eq(userPreferences.preference_key, key)
        )
      );

    // If no rows were updated, insert a new preference
    if (result.changes === 0) {
      await this.db.insert(userPreferences).values({
        id: nanoid(),
        user_id: userId,
        preference_key: key,
        preference_value: stringValue,
        created_at: now,
        updated_at: now,
      });
    }
  }

  /**
   * Delete a specific preference
   */
  async deletePreference(userId: string, key: string): Promise<void> {
    await this.db
      .delete(userPreferences)
      .where(
        and(
          eq(userPreferences.user_id, userId),
          eq(userPreferences.preference_key, key)
        )
      );
  }

  /**
   * Update multiple preferences at once
   */
  async updatePreferences(userId: string, updates: Partial<UserPreferences>): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        promises.push(this.setPreference(userId, key, value));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Complete the walkthrough for a user
   */
  async completeWalkthrough(userId: string): Promise<void> {
    await this.setPreference(userId, 'walkthrough_completed', true);
    // Optionally set completion timestamp if you add that to config
  }

  /**
   * Cancel the walkthrough for a user
   */
  async cancelWalkthrough(userId: string): Promise<void> {
    await this.setPreference(userId, 'walkthrough_cancelled', true);
  }

  /**
   * Check if user should see the walkthrough
   */
  async shouldShowWalkthrough(userId: string): Promise<boolean> {
    const completed = await this.getPreference(userId, 'walkthrough_completed', false);
    const cancelled = await this.getPreference(userId, 'walkthrough_cancelled', false);
    
    return !completed && !cancelled;
  }

  /**
   * Acknowledge a notification (simplified - stores as comma-separated string)
   */
  async acknowledgeNotification(userId: string, notificationId: string): Promise<void> {
    // For simplicity, we'll store acknowledgments as a comma-separated string
    // In a more complex system, you might want a separate table for this
    const currentAcknowledgments = await this.getPreference(userId, 'notification_acknowledgments', '') as string;
    const acknowledgmentsList = currentAcknowledgments ? currentAcknowledgments.split(',') : [];
    
    if (!acknowledgmentsList.includes(notificationId)) {
      acknowledgmentsList.push(notificationId);
      await this.setPreference(userId, 'notification_acknowledgments', acknowledgmentsList.join(','));
    }
  }

  /**
   * Check if a notification has been acknowledged
   */
  async isNotificationAcknowledged(userId: string, notificationId: string): Promise<boolean> {
    const acknowledgments = await this.getPreference(userId, 'notification_acknowledgments', '') as string;
    if (!acknowledgments) return false;
    
    const acknowledgmentsList = acknowledgments.split(',');
    return acknowledgmentsList.includes(notificationId);
  }

  /**
   * Set UI theme preference
   */
  async setTheme(userId: string, theme: 'light' | 'dark' | 'auto'): Promise<void> {
    await this.setPreference(userId, 'theme', theme);
  }

  /**
   * Get all users with a specific preference value (useful for analytics/admin)
   */
  async getUsersWithPreference(key: string, value: PreferenceValue): Promise<string[]> {
    const users = await this.db
      .select({ user_id: userPreferences.user_id })
      .from(userPreferences)
      .where(
        and(
          eq(userPreferences.preference_key, key),
          eq(userPreferences.preference_value, String(value))
        )
      );

    return users.map((u: { user_id: string }) => u.user_id);
  }

  /**
   * Parse a preference value from string back to its original type
   */
  private parsePreferenceValue(key: string, stringValue: string): PreferenceValue {
    if (!isValidPreferenceKey(key)) {
      return stringValue; // Return as string if key is not recognized
    }

    const defaultValue = DEFAULT_USER_PREFERENCES[key];
    const expectedType = typeof defaultValue;

    switch (expectedType) {
      case 'boolean':
        return stringValue === 'true';
      case 'number':
        const num = Number(stringValue);
        return isNaN(num) ? defaultValue : num;
      case 'string':
      default:
        return stringValue;
    }
  }
}
