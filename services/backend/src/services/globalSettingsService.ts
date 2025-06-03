import { getDb, getSchema } from '../db';
import { eq, like } from 'drizzle-orm';
import { encrypt, decrypt } from '../utils/encryption';

export interface GlobalSetting {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean';
  description: string | null;
  is_encrypted: boolean;
  group_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface GlobalSettingGroup {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface GlobalSettingGroupWithSettings extends GlobalSettingGroup {
  settings: GlobalSetting[];
}

export interface CreateGlobalSettingInput {
  key: string;
  value: string | number | boolean;
  type: 'string' | 'number' | 'boolean';
  description?: string;
  encrypted?: boolean;
  group_id?: string;
}

export interface UpdateGlobalSettingInput {
  value?: string | number | boolean;
  type?: 'string' | 'number' | 'boolean';
  description?: string;
  encrypted?: boolean;
  group_id?: string;
}

export class GlobalSettingsService {
  private static validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Setting key is required and must be a string');
    }
    
    if (key.length > 255) {
      throw new Error('Setting key must be 255 characters or less');
    }
    
    // Allow alphanumeric, dots, underscores, and hyphens
    const validKeyPattern = /^[a-zA-Z0-9._-]+$/;
    if (!validKeyPattern.test(key)) {
      throw new Error('Setting key can only contain letters, numbers, dots, underscores, and hyphens');
    }
  }

  private static validateValue(value: string): void {
    if (value === undefined || value === null) {
      throw new Error('Setting value is required');
    }
    
    if (typeof value !== 'string') {
      throw new Error('Setting value must be a string');
    }
  }

  /**
   * Convert a typed value to string for database storage
   */
  private static convertValueToString(value: string | number | boolean): string {
    return String(value);
  }

  /**
   * Convert a string value from database to its proper type
   */
  private static convertValueToType(value: string, type: 'string' | 'number' | 'boolean'): string | number | boolean {
    switch (type) {
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number value: ${value}`);
        }
        return num;
      case 'boolean':
        if (value === 'true') return true;
        if (value === 'false') return false;
        throw new Error(`Invalid boolean value: ${value}. Must be 'true' or 'false'`);
      case 'string':
      default:
        return value;
    }
  }

  /**
   * Validate that a value matches its declared type
   */
  private static validateValueType(value: string | number | boolean, type: 'string' | 'number' | 'boolean'): void {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new Error(`Value must be a string, got ${typeof value}`);
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new Error(`Value must be a number, got ${typeof value}`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error(`Value must be a boolean, got ${typeof value}`);
        }
        break;
      default:
        throw new Error(`Invalid type: ${type}`);
    }
  }

  /**
   * Get a setting by key
   * Automatically decrypts encrypted values
   */
  static async get(key: string): Promise<GlobalSetting | null> {
    this.validateKey(key);
    
    const db = getDb();
    const schema = getSchema();

    try {
      const results = await db
        .select()
        .from(schema.globalSettings)
        .where(eq(schema.globalSettings.key, key))
        .limit(1);

      if (results.length === 0) {
        return null;
      }

      const setting = results[0] as GlobalSetting;
      
      // Decrypt value if it's encrypted
      if (setting.is_encrypted && setting.value) {
        try {
          setting.value = decrypt(setting.value);
        } catch (error) {
          throw new Error(`Failed to decrypt setting '${key}': ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return setting;
    } catch (error) {
      throw new Error(`Failed to get setting '${key}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all settings
   * Automatically decrypts encrypted values
   */
  static async getAll(): Promise<GlobalSetting[]> {
    const db = getDb();
    const schema = getSchema();

    try {
      const results = await db
        .select()
        .from(schema.globalSettings)
        .orderBy(schema.globalSettings.key);

      // Decrypt encrypted values
      return results.map((setting: any) => {
        if (setting.is_encrypted && setting.value) {
          try {
            setting.value = decrypt(setting.value);
          } catch (error) {
            // Log error but don't fail the entire operation
            console.error(`Failed to decrypt setting '${setting.key}':`, error);
            setting.value = '[DECRYPTION_FAILED]';
          }
        }
        return setting as GlobalSetting;
      });
    } catch (error) {
      throw new Error(`Failed to get all settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get settings by group
   */
  static async getByGroup(groupId: string): Promise<GlobalSetting[]> {
    if (!groupId || typeof groupId !== 'string') {
      throw new Error('Group ID is required and must be a string');
    }

    const db = getDb();
    const schema = getSchema();

    try {
      const results = await db
        .select()
        .from(schema.globalSettings)
        .where(eq(schema.globalSettings.group_id, groupId))
        .orderBy(schema.globalSettings.key);

      // Decrypt encrypted values
      return results.map((setting: any) => {
        if (setting.is_encrypted && setting.value) {
          try {
            setting.value = decrypt(setting.value);
          } catch (error) {
            console.error(`Failed to decrypt setting '${setting.key}':`, error);
            setting.value = '[DECRYPTION_FAILED]';
          }
        }
        return setting as GlobalSetting;
      });
    } catch (error) {
      throw new Error(`Failed to get settings for group '${groupId}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create or update a setting (legacy method for backward compatibility)
   */
  static async set(key: string, value: string, options: { description?: string; encrypted?: boolean; group_id?: string } = {}): Promise<GlobalSetting> {
    return this.setTyped(key, value, 'string', options);
  }

  /**
   * Create or update a setting with type support
   */
  static async setTyped(
    key: string, 
    value: string | number | boolean, 
    type: 'string' | 'number' | 'boolean',
    options: { description?: string; encrypted?: boolean; group_id?: string } = {}
  ): Promise<GlobalSetting> {
    this.validateKey(key);
    this.validateValueType(value, type);

    const { description, encrypted = false, group_id } = options;
    const db = getDb();
    const schema = getSchema();

    try {
      // Check if setting already exists (avoid recursion)
      const existingResults = await db
        .select()
        .from(schema.globalSettings)
        .where(eq(schema.globalSettings.key, key))
        .limit(1);
      const existing = existingResults.length > 0 ? existingResults[0] : null;
      const now = new Date();

      // Convert value to string for storage
      const stringValue = this.convertValueToString(value);
      
      // Prepare the value (encrypt if needed)
      let finalValue = stringValue;
      if (encrypted) {
        finalValue = encrypt(stringValue);
      }

      const settingData = {
        key,
        value: finalValue,
        type,
        description: description || null,
        is_encrypted: encrypted,
        group_id: group_id || null,
        updated_at: now,
      };

      if (existing) {
        // Update existing setting
        await db
          .update(schema.globalSettings)
          .set(settingData)
          .where(eq(schema.globalSettings.key, key));
      } else {
        // Create new setting
        await db
          .insert(schema.globalSettings)
          .values({
            ...settingData,
            created_at: now,
          });
      }

      // Return the setting (with decrypted value)
      const result = await this.get(key);
      if (!result) {
        throw new Error('Failed to retrieve setting after creation/update');
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to set setting '${key}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing setting
   */
  static async update(key: string, updates: UpdateGlobalSettingInput): Promise<GlobalSetting | null> {
    this.validateKey(key);

    const existing = await this.get(key);
    if (!existing) {
      return null;
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date(),
    };

    if (updates.value !== undefined) {
      // Validate value type if type is provided
      if (updates.type) {
        this.validateValueType(updates.value, updates.type);
      }
      
      // Convert value to string for storage
      const stringValue = this.convertValueToString(updates.value);
      updateData.value = updates.encrypted ? encrypt(stringValue) : stringValue;
      updateData.is_encrypted = updates.encrypted || false;
      
      // Update type if provided
      if (updates.type) {
        updateData.type = updates.type;
      }
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    if (updates.group_id !== undefined) {
      updateData.group_id = updates.group_id;
    }

    const db = getDb();
    const schema = getSchema();

    try {
      await db
        .update(schema.globalSettings)
        .set(updateData)
        .where(eq(schema.globalSettings.key, key));

      return await this.get(key);
    } catch (error) {
      throw new Error(`Failed to update setting '${key}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a setting
   */
  static async delete(key: string): Promise<boolean> {
    this.validateKey(key);
    const db = getDb();
    const schema = getSchema();

    try {
      const result = await db
        .delete(schema.globalSettings)
        .where(eq(schema.globalSettings.key, key));

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete setting '${key}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search settings by key pattern
   */
  static async search(pattern: string): Promise<GlobalSetting[]> {
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('Search pattern is required and must be a string');
    }

    const db = getDb();
    const schema = getSchema();

    try {
      const results = await db
        .select()
        .from(schema.globalSettings)
        .where(like(schema.globalSettings.key, `%${pattern}%`))
        .orderBy(schema.globalSettings.key);

      // Decrypt encrypted values
      return results.map((setting: any) => {
        if (setting.is_encrypted && setting.value) {
          try {
            setting.value = decrypt(setting.value);
          } catch (error) {
            console.error(`Failed to decrypt setting '${setting.key}':`, error);
            setting.value = '[DECRYPTION_FAILED]';
          }
        }
        return setting as GlobalSetting;
      });
    } catch (error) {
      throw new Error(`Failed to search settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all unique group IDs (categories)
   */
  static async getCategories(): Promise<string[]> {
    const db = getDb();
    const schema = getSchema();

    try {
      const results = await db
        .selectDistinct({ group_id: schema.globalSettings.group_id })
        .from(schema.globalSettings)
        .orderBy(schema.globalSettings.group_id);

      return results
        .map((row: { group_id: string | null }) => row.group_id)
        .filter((group_id: string | null): group_id is string => group_id !== null);
    } catch (error) {
      throw new Error(`Failed to get categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all groups with their metadata from the globalSettingGroups table.
   * Does not include the settings themselves.
   */
  static async getAllGroupMetadata(): Promise<GlobalSettingGroup[]> {
    const db = getDb();
    const schema = getSchema();
    try {
      const results = await db
        .select()
        .from(schema.globalSettingGroups)
        .orderBy(schema.globalSettingGroups.sort_order, schema.globalSettingGroups.name); // Sort by sort_order, then name
      return results as GlobalSettingGroup[];
    } catch (error) {
      throw new Error(`Failed to get all group metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all groups with their metadata and their associated settings.
   */
  static async getAllGroupsWithSettings(): Promise<GlobalSettingGroupWithSettings[]> {
    const groupMetadatas = await this.getAllGroupMetadata();
    const groupsWithSettings: GlobalSettingGroupWithSettings[] = [];

    for (const groupMetadata of groupMetadatas) {
      const settings = await this.getByGroup(groupMetadata.id);
      groupsWithSettings.push({
        ...groupMetadata,
        settings: settings,
      });
    }
    // The groups are already sorted by getAllGroupMetadata
    return groupsWithSettings;
  }

  /**
   * Get a specific group by ID
   */
  static async getGroup(groupId: string): Promise<GlobalSettingGroup | null> {
    if (!groupId || typeof groupId !== 'string') {
      throw new Error('Group ID is required and must be a string');
    }

    const db = getDb();
    const schema = getSchema();

    try {
      const results = await db
        .select()
        .from(schema.globalSettingGroups)
        .where(eq(schema.globalSettingGroups.id, groupId))
        .limit(1);
      
      return results.length > 0 ? results[0] as GlobalSettingGroup : null;
    } catch (error) {
      throw new Error(`Failed to get group '${groupId}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new global setting group
   */
  static async createGroup(groupData: { id: string; name: string; description?: string; icon?: string; sort_order?: number }): Promise<GlobalSettingGroup> {
    const { id, name, description, icon, sort_order } = groupData;

    if (!id || typeof id !== 'string') {
      throw new Error('Group ID is required and must be a string');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('Group name is required and must be a string');
    }

    const db = getDb();
    const schema = getSchema();
    const now = new Date();
    const newGroup = {
      id,
      name,
      description: description || null,
      icon: icon || null,
      sort_order: sort_order || 0,
      created_at: now,
      updated_at: now,
    };

    try {
      await db
        .insert(schema.globalSettingGroups)
        .values(newGroup);
      
      // Re-fetch to confirm creation
      const createdGroup = await this.getGroup(id);
      if (!createdGroup) {
        throw new Error(`Failed to retrieve group '${id}' after creation.`);
      }
      return createdGroup;
    } catch (error) {
      throw new Error(`Failed to create group '${id}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Check if a setting exists
   */
  static async exists(key: string): Promise<boolean> {
    this.validateKey(key);
    const db = getDb();
    const schema = getSchema();

    try {
      const results = await db
        .select({ key: schema.globalSettings.key })
        .from(schema.globalSettings)
        .where(eq(schema.globalSettings.key, key))
        .limit(1);

      return results.length > 0;
    } catch (error) {
      throw new Error(`Failed to check if setting exists '${key}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
