import { getDb, getSchema } from '../db';
import { eq, like } from 'drizzle-orm';
import { encrypt, decrypt } from '../utils/encryption';

export interface GlobalSetting {
  key: string;
  value: string;
  description?: string;
  is_encrypted: boolean;
  group_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateGlobalSettingInput {
  key: string;
  value: string;
  description?: string;
  encrypted?: boolean;
  group_id?: string;
}

export interface UpdateGlobalSettingInput {
  value?: string;
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
   * Get a setting by key
   * Automatically decrypts encrypted values
   */
  static async get(key: string): Promise<GlobalSetting | null> {
    this.validateKey(key);
    
    const db = getDb();
    const schema = getSchema();
    const globalSettingsTable = schema.globalSettings;

    if (!globalSettingsTable) {
      throw new Error('GlobalSettings table not found in schema');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await (db as any)
        .select()
        .from(globalSettingsTable)
        .where(eq(globalSettingsTable.key, key))
        .limit(1);

      if (results.length === 0) {
        return null;
      }

      const setting = results[0];
      
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
    const globalSettingsTable = schema.globalSettings;

    if (!globalSettingsTable) {
      throw new Error('GlobalSettings table not found in schema');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await (db as any)
        .select()
        .from(globalSettingsTable)
        .orderBy(globalSettingsTable.key);

      // Decrypt encrypted values
      return results.map((setting: GlobalSetting) => {
        if (setting.is_encrypted && setting.value) {
          try {
            setting.value = decrypt(setting.value);
          } catch (error) {
            // Log error but don't fail the entire operation
            console.error(`Failed to decrypt setting '${setting.key}':`, error);
            setting.value = '[DECRYPTION_FAILED]';
          }
        }
        return setting;
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
    const globalSettingsTable = schema.globalSettings;

    if (!globalSettingsTable) {
      throw new Error('GlobalSettings table not found in schema');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await (db as any)
        .select()
        .from(globalSettingsTable)
        .where(eq(globalSettingsTable.group_id, groupId))
        .orderBy(globalSettingsTable.key);

      // Decrypt encrypted values
      return results.map((setting: GlobalSetting) => {
        if (setting.is_encrypted && setting.value) {
          try {
            setting.value = decrypt(setting.value);
          } catch (error) {
            console.error(`Failed to decrypt setting '${setting.key}':`, error);
            setting.value = '[DECRYPTION_FAILED]';
          }
        }
        return setting;
      });
    } catch (error) {
      throw new Error(`Failed to get settings for group '${groupId}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create or update a setting
   */
  static async set(key: string, value: string, options: { description?: string; encrypted?: boolean; group_id?: string } = {}): Promise<GlobalSetting> {
    this.validateKey(key);
    this.validateValue(value);

    const { description, encrypted = false, group_id } = options;

    const db = getDb();
    const schema = getSchema();
    const globalSettingsTable = schema.globalSettings;

    if (!globalSettingsTable) {
      throw new Error('GlobalSettings table not found in schema');
    }

    try {
      // Check if setting already exists
      const existing = await this.get(key);
      const now = new Date();

      // Prepare the value (encrypt if needed)
      let finalValue = value;
      if (encrypted) {
        finalValue = encrypt(value);
      }

      const settingData = {
        key,
        value: finalValue,
        description: description || null,
        is_encrypted: encrypted,
        group_id: group_id || null,
        updated_at: now,
      };

      if (existing) {
        // Update existing setting
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)
          .update(globalSettingsTable)
          .set(settingData)
          .where(eq(globalSettingsTable.key, key));
      } else {
        // Create new setting
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)
          .insert(globalSettingsTable)
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
    const updateData: Partial<GlobalSetting> = {
      updated_at: new Date(),
    };

    if (updates.value !== undefined) {
      this.validateValue(updates.value);
      updateData.value = updates.encrypted ? encrypt(updates.value) : updates.value;
      updateData.is_encrypted = updates.encrypted || false;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    if (updates.group_id !== undefined) {
      updateData.group_id = updates.group_id;
    }

    const db = getDb();
    const schema = getSchema();
    const globalSettingsTable = schema.globalSettings;

    if (!globalSettingsTable) {
      throw new Error('GlobalSettings table not found in schema');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .update(globalSettingsTable)
        .set(updateData)
        .where(eq(globalSettingsTable.key, key));

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
    const globalSettingsTable = schema.globalSettings;

    if (!globalSettingsTable) {
      throw new Error('GlobalSettings table not found in schema');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (db as any)
        .delete(globalSettingsTable)
        .where(eq(globalSettingsTable.key, key));

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
    const globalSettingsTable = schema.globalSettings;

    if (!globalSettingsTable) {
      throw new Error('GlobalSettings table not found in schema');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await (db as any)
        .select()
        .from(globalSettingsTable)
        .where(like(globalSettingsTable.key, `%${pattern}%`))
        .orderBy(globalSettingsTable.key);

      // Decrypt encrypted values
      return results.map((setting: GlobalSetting) => {
        if (setting.is_encrypted && setting.value) {
          try {
            setting.value = decrypt(setting.value);
          } catch (error) {
            console.error(`Failed to decrypt setting '${setting.key}':`, error);
            setting.value = '[DECRYPTION_FAILED]';
          }
        }
        return setting;
      });
    } catch (error) {
      throw new Error(`Failed to search settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all unique categories
   */
  static async getCategories(): Promise<string[]> {
    const db = getDb();
    const schema = getSchema();
    const globalSettingsTable = schema.globalSettings;

    if (!globalSettingsTable) {
      throw new Error('GlobalSettings table not found in schema');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await (db as any)
        .selectDistinct({ category: globalSettingsTable.category })
        .from(globalSettingsTable)
        .where(eq(globalSettingsTable.category, globalSettingsTable.category)) // Only non-null categories
        .orderBy(globalSettingsTable.category);

      return results
        .map((row: { category: string | null }) => row.category)
        .filter((category: string | null): category is string => category !== null);
    } catch (error) {
      throw new Error(`Failed to get categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a setting exists
   */
  static async exists(key: string): Promise<boolean> {
    this.validateKey(key);

    const db = getDb();
    const schema = getSchema();
    const globalSettingsTable = schema.globalSettings;

    if (!globalSettingsTable) {
      throw new Error('GlobalSettings table not found in schema');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await (db as any)
        .select({ key: globalSettingsTable.key })
        .from(globalSettingsTable)
        .where(eq(globalSettingsTable.key, key))
        .limit(1);

      return results.length > 0;
    } catch (error) {
      throw new Error(`Failed to check if setting exists '${key}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
