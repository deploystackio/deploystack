/**
 * User Preferences Configuration
 * 
 * This file defines the default preferences that are automatically created
 * for new users when they register. Adding new preferences here requires
 * only an application restart - no database migrations needed.
 * 
 * IMPORTANT: Changes to this file only affect NEW users. Existing users
 * will not automatically receive new preference keys.
 */

// Type definitions for preference values
export type PreferenceValue = string | number | boolean;

// Default user preferences configuration
export const DEFAULT_USER_PREFERENCES: Record<string, PreferenceValue> = {
  // Survey preferences
  // show_survey_overall: true,
  // show_survey_company: true,
  
  // Walkthrough preferences
  walkthrough_completed: false,
  walkthrough_cancelled: false,
  
  // UI preferences
  // theme: 'auto', // 'light', 'dark', 'auto'
  // sidebar_collapsed: false,
  
  // Notification preferences
  email_notifications_enabled: true,
  browser_notifications_enabled: true,
  notification_acknowledgments: '', // Comma-separated list of acknowledged notification IDs
  
  // Feature preferences
  beta_features_enabled: false,
} as const;

// Type for user preference keys (for type safety)
export type UserPreferenceKey = keyof typeof DEFAULT_USER_PREFERENCES;

// Helper function to get default value for a preference key
export function getDefaultPreferenceValue(key: string): PreferenceValue | undefined {
  return DEFAULT_USER_PREFERENCES[key as UserPreferenceKey];
}

// Helper function to get all default preferences as an array of key-value pairs
export function getDefaultPreferencesArray(): Array<{ key: string; value: PreferenceValue }> {
  return Object.entries(DEFAULT_USER_PREFERENCES).map(([key, value]) => ({
    key,
    value,
  }));
}

// Validation function to check if a preference key is valid
export function isValidPreferenceKey(key: string): key is UserPreferenceKey {
  return key in DEFAULT_USER_PREFERENCES;
}

// Helper function to validate preference value type
export function isValidPreferenceValue(key: string, value: unknown): value is PreferenceValue {
  if (!isValidPreferenceKey(key)) {
    return false;
  }
  
  const defaultValue = DEFAULT_USER_PREFERENCES[key];
  const expectedType = typeof defaultValue;
  
  return typeof value === expectedType;
}
