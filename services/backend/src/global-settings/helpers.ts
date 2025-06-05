import { GlobalSettingsService } from '../services/globalSettingsService';

/**
 * GlobalSettings Helper Methods
 * 
 * Provides simple, type-safe helper methods for retrieving global settings values
 * from the database. Similar to the Email service helper methods pattern.
 * 
 * These helpers are designed for common use cases where you just need the value
 * of a setting. For more complex operations (creating, updating, searching),
 * use the GlobalSettingsService directly.
 */
export class GlobalSettings {
  /**
   * Get a setting value as a string
   * Returns null if the setting doesn't exist or has no value
   */
  static async get(key: string): Promise<string | null>;
  static async get(key: string, defaultValue: string): Promise<string>;
  static async get(key: string, defaultValue?: string): Promise<string | null> {
    try {
      const setting = await GlobalSettingsService.get(key);
      
      if (!setting || !setting.value || setting.value.trim() === '') {
        return defaultValue ?? null;
      }
      
      return setting.value;
    } catch (error) {
      console.error(`Failed to get setting '${key}':`, error);
      return defaultValue ?? null;
    }
  }

  /**
   * Get a setting value as a string (alias for get)
   * Useful for explicit type clarity
   */
  static async getString(key: string): Promise<string | null>;
  static async getString(key: string, defaultValue: string): Promise<string>;
  static async getString(key: string, defaultValue?: string): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.get(key, defaultValue as any);
  }

  /**
   * Get a setting value as a boolean
   * Accepts: 'true', 'false', '1', '0', 'yes', 'no', 'on', 'off'
   * Returns null if the setting doesn't exist or can't be parsed as boolean
   */
  static async getBoolean(key: string): Promise<boolean | null>;
  static async getBoolean(key: string, defaultValue: boolean): Promise<boolean>;
  static async getBoolean(key: string, defaultValue?: boolean): Promise<boolean | null> {
    try {
      const value = await this.get(key);
      
      if (value === null) {
        return defaultValue ?? null;
      }
      
      const normalizedValue = value.toLowerCase().trim();
      
      // Handle common boolean representations
      if (['true', '1', 'yes', 'on', 'enabled'].includes(normalizedValue)) {
        return true;
      }
      
      if (['false', '0', 'no', 'off', 'disabled'].includes(normalizedValue)) {
        return false;
      }
      
      // If we can't parse it, return default
      console.warn(`Setting '${key}' has value '${value}' which cannot be parsed as boolean`);
      return defaultValue ?? null;
    } catch (error) {
      console.error(`Failed to get boolean setting '${key}':`, error);
      return defaultValue ?? null;
    }
  }

  /**
   * Get a setting value as a number
   * Returns null if the setting doesn't exist or can't be parsed as number
   */
  static async getNumber(key: string): Promise<number | null>;
  static async getNumber(key: string, defaultValue: number): Promise<number>;
  static async getNumber(key: string, defaultValue?: number): Promise<number | null> {
    try {
      const value = await this.get(key);
      
      if (value === null) {
        return defaultValue ?? null;
      }
      
      const numValue = Number(value);
      
      if (isNaN(numValue)) {
        console.warn(`Setting '${key}' has value '${value}' which cannot be parsed as number`);
        return defaultValue ?? null;
      }
      
      return numValue;
    } catch (error) {
      console.error(`Failed to get number setting '${key}':`, error);
      return defaultValue ?? null;
    }
  }

  /**
   * Get a setting value as an integer
   * Returns null if the setting doesn't exist or can't be parsed as integer
   */
  static async getInteger(key: string): Promise<number | null>;
  static async getInteger(key: string, defaultValue: number): Promise<number>;
  static async getInteger(key: string, defaultValue?: number): Promise<number | null> {
    try {
      const numValue = await this.getNumber(key);
      
      if (numValue === null) {
        return defaultValue ?? null;
      }
      
      return Math.floor(numValue);
    } catch (error) {
      console.error(`Failed to get integer setting '${key}':`, error);
      return defaultValue ?? null;
    }
  }

  /**
   * Get multiple settings at once
   * Returns an object with keys as setting keys and values as setting values
   * Missing or empty settings will have null values
   */
  static async getMultiple(keys: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    
    // Process all keys in parallel for better performance
    const promises = keys.map(async (key) => {
      const value = await this.get(key);
      return { key, value };
    });
    
    const results = await Promise.all(promises);
    
    for (const { key, value } of results) {
      result[key] = value;
    }
    
    return result;
  }

  /**
   * Get all settings in a group as key-value pairs
   * Returns an object with setting keys (without group prefix) as keys and values as setting values
   * Example: getGroupValues('smtp') returns { 'host': 'smtp.gmail.com', 'port': '587', ... }
   */
  static async getGroupValues(groupId: string): Promise<Record<string, string | null>> {
    try {
      const settings = await GlobalSettingsService.getByGroup(groupId);
      const result: Record<string, string | null> = {};
      
      for (const setting of settings) {
        // Extract the key part after the group prefix
        // e.g., 'smtp.host' -> 'host', 'api.openai.key' -> 'openai.key'
        const keyParts = setting.key.split('.');
        const keyWithoutGroup = keyParts.slice(1).join('.');
        
        result[keyWithoutGroup] = setting.value || null;
      }
      
      return result;
    } catch (error) {
      console.error(`Failed to get group values for '${groupId}':`, error);
      return {};
    }
  }

  /**
   * Get all settings in a group with full keys
   * Returns an object with full setting keys as keys and values as setting values
   * Example: getGroupValuesWithFullKeys('smtp') returns { 'smtp.host': 'smtp.gmail.com', 'smtp.port': '587', ... }
   */
  static async getGroupValuesWithFullKeys(groupId: string): Promise<Record<string, string | null>> {
    try {
      const settings = await GlobalSettingsService.getByGroup(groupId);
      const result: Record<string, string | null> = {};
      
      for (const setting of settings) {
        result[setting.key] = setting.value || null;
      }
      
      return result;
    } catch (error) {
      console.error(`Failed to get group values with full keys for '${groupId}':`, error);
      return {};
    }
  }

  /**
   * Check if a setting exists and has a non-empty value
   */
  static async isSet(key: string): Promise<boolean> {
    try {
      const value = await this.get(key);
      return value !== null && value.trim() !== '';
    } catch (error) {
      console.error(`Failed to check if setting is set '${key}':`, error);
      return false;
    }
  }

  /**
   * Check if a setting is empty (doesn't exist or has empty value)
   */
  static async isEmpty(key: string): Promise<boolean> {
    return !(await this.isSet(key));
  }

  /**
   * Get a required setting value
   * Throws an error if the setting doesn't exist or is empty
   */
  static async getRequired(key: string): Promise<string> {
    const value = await this.get(key);
    
    if (value === null || value.trim() === '') {
      throw new Error(`Required setting '${key}' is not configured or is empty`);
    }
    
    return value;
  }

  /**
   * Get a setting value and validate it as a URL
   * Returns null if the setting doesn't exist or is not a valid URL
   */
  static async getUrl(key: string): Promise<string | null>;
  static async getUrl(key: string, defaultValue: string): Promise<string>;
  static async getUrl(key: string, defaultValue?: string): Promise<string | null> {
    try {
      const value = await this.get(key);
      
      if (value === null) {
        return defaultValue ?? null;
      }
      
      // Validate URL format
      try {
        new URL(value);
        return value;
      } catch {
        console.warn(`Setting '${key}' has value '${value}' which is not a valid URL`);
        return defaultValue ?? null;
      }
    } catch (error) {
      console.error(`Failed to get URL setting '${key}':`, error);
      return defaultValue ?? null;
    }
  }

  /**
   * Get a setting value and validate it as an email address
   * Returns null if the setting doesn't exist or is not a valid email
   */
  static async getEmail(key: string): Promise<string | null>;
  static async getEmail(key: string, defaultValue: string): Promise<string>;
  static async getEmail(key: string, defaultValue?: string): Promise<string | null> {
    try {
      const value = await this.get(key);
      
      if (value === null) {
        return defaultValue ?? null;
      }
      
      // Basic email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (emailRegex.test(value)) {
        return value;
      } else {
        console.warn(`Setting '${key}' has value '${value}' which is not a valid email address`);
        return defaultValue ?? null;
      }
    } catch (error) {
      console.error(`Failed to get email setting '${key}':`, error);
      return defaultValue ?? null;
    }
  }

  /**
   * Get a setting value as a JSON object
   * Returns null if the setting doesn't exist or can't be parsed as JSON
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async getJson<T = any>(key: string): Promise<T | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async getJson<T = any>(key: string, defaultValue: T): Promise<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async getJson<T = any>(key: string, defaultValue?: T): Promise<T | null> {
    try {
      const value = await this.get(key);
      
      if (value === null) {
        return defaultValue ?? null;
      }
      
      try {
        return JSON.parse(value) as T;
      } catch {
        console.warn(`Setting '${key}' has value '${value}' which cannot be parsed as JSON`);
        return defaultValue ?? null;
      }
    } catch (error) {
      console.error(`Failed to get JSON setting '${key}':`, error);
      return defaultValue ?? null;
    }
  }

  /**
   * Get a setting value as an array (comma-separated values)
   * Returns empty array if the setting doesn't exist
   */
  static async getArray(key: string): Promise<string[]>;
  static async getArray(key: string, defaultValue: string[]): Promise<string[]>;
  static async getArray(key: string, defaultValue?: string[]): Promise<string[]> {
    try {
      const value = await this.get(key);
      
      if (value === null || value.trim() === '') {
        return defaultValue ?? [];
      }
      
      // Split by comma and trim whitespace
      return value.split(',').map(item => item.trim()).filter(item => item !== '');
    } catch (error) {
      console.error(`Failed to get array setting '${key}':`, error);
      return defaultValue ?? [];
    }
  }

  /**
   * Check if a setting exists in the database (regardless of value)
   */
  static async exists(key: string): Promise<boolean> {
    try {
      return await GlobalSettingsService.exists(key);
    } catch (error) {
      console.error(`Failed to check if setting exists '${key}':`, error);
      return false;
    }
  }

  /**
   * Get the raw setting object (includes metadata)
   * Use this when you need access to description, encryption status, etc.
   */
  static async getRaw(key: string) {
    return GlobalSettingsService.get(key);
  }

  /**
   * Refresh any cached configurations
   * Call this after updating settings that might be cached by other services
   */
  static async refreshCaches(): Promise<void> {
    // This could be extended to notify other services to refresh their caches
    // For now, we don't have any caching in the GlobalSettings helpers themselves
    console.log('GlobalSettings cache refresh requested (no caches to clear)');
  }
}
