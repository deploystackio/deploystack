import fs from 'fs';
import path from 'path';
import { GlobalSettingsService } from '../services/globalSettingsService';
import { getDb, getSchema } from '../db';
import { eq } from 'drizzle-orm';
import type { 
  GlobalSettingsModule, 
  GlobalSettingDefinition, 
  GlobalSettingGroup,
  ValidationResult, 
  SmtpConfig, 
  GitHubOAuthConfig, 
  GlobalConfig,
  InitializationResult 
} from './types';

export class GlobalSettingsInitService {
  private static settingsModules: GlobalSettingsModule[] = [];
  private static isLoaded = false;

  /**
   * Dynamically load all settings modules from the global-settings directory
   */
  static async loadSettingsDefinitions(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    try {
      const settingsDir = __dirname;
      
      const files = fs.readdirSync(settingsDir);
      
      // Filter for .ts/.js files, exclude index, types, helpers, and cache files
      const settingFiles = files.filter(file =>
        (file.endsWith('.ts') || file.endsWith('.js')) &&
        file !== 'index.ts' &&
        file !== 'index.js' &&
        file !== 'types.ts' &&
        file !== 'types.js' &&
        file !== 'helpers.ts' &&
        file !== 'helpers.js' &&
        file !== 'cache.ts' &&
        file !== 'cache.js'
      );

      for (const file of settingFiles) {
        try {
          const filePath = path.join(settingsDir, file);
          
          const module = await import(filePath);
          
          // Look for exported settings modules
          for (const exportName of Object.keys(module)) {
            const exportedValue = module[exportName];
            
            if (exportedValue && 
                typeof exportedValue === 'object' && 
                exportedValue.group && 
                Array.isArray(exportedValue.settings)) {
              this.settingsModules.push(exportedValue as GlobalSettingsModule);
            }
          }
        } catch {
          // Silently continue on error
        }
      }

      this.isLoaded = true;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all settings from all loaded modules
   */
  static getAllSettings(): GlobalSettingDefinition[] {
    return this.settingsModules.flatMap(module => module.settings);
  }

  /**
   * Get settings by group
   */
  static getSettingsByGroup(groupId: string): GlobalSettingDefinition[] {
    const module = this.settingsModules.find(m => m.group.id === groupId);
    return module ? module.settings : [];
  }

  /**
   * Get all loaded groups
   */
  static getGroups(): GlobalSettingGroup[] {
    return this.settingsModules.map(m => m.group);
  }

  /**
   * Initialize groups and settings in the database (non-destructive)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async initializeSettings(logger?: any): Promise<InitializationResult> {
    try {
      if (!this.isLoaded) {
        await this.loadSettingsDefinitions();
      }

      // First, create groups using batch operations
      try {
        await this.createGroupsBatch();
      } catch {
        // Continue with settings creation even if group creation fails
      }

      // Then, create settings using batch operations
      const allSettings = this.getAllSettings();
      
      const result: InitializationResult = {
        totalModules: this.settingsModules.length,
        totalSettings: allSettings.length,
        created: 0,
        skipped: 0,
        createdSettings: [],
        skippedSettings: []
      };

      try {
        await this.createSettingsBatch(allSettings, result);
      } catch {
        // Fallback to individual creation if batch fails
        await this.createSettingsIndividually(allSettings, result);
      }

      // Update existing settings with name field if missing
      try {
        await this.updateSettingsMetadata(allSettings);
      } catch (error) {
        if (logger) {
          logger.debug({
            operation: 'update_settings_metadata',
            error: error instanceof Error ? error.message : String(error)
          }, 'Failed to update settings metadata during initialization');
        }
      }

      // Check for missing required settings
      try {
        await this.validateRequiredSettings();
      } catch (error) {
        if (logger) {
          logger.debug({
            operation: 'validate_required_settings',
            error: error instanceof Error ? error.message : String(error)
          }, 'Validation of required settings failed during initialization');
        }
      }

      return result;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create groups in the database using batch operations (non-destructive)
   */
  private static async createGroupsBatch(): Promise<void> {
    const groups = this.getGroups();
    
    // Check which groups need to be created
    const groupsToCreate: GlobalSettingGroup[] = [];
    
    for (const group of groups) {
      try {
        const exists = await this.groupExists(group.id);
        if (!exists) {
          groupsToCreate.push(group);
        }
      } catch {
        // Silently continue on error
      }
    }

    if (groupsToCreate.length === 0) {
      return;
    }

    // Create groups using database-specific batch operations
    try {
      await this.executeBatchGroupCreation(groupsToCreate);
    } catch {
      // Fallback to individual creation
      await this.createGroupsIndividually(groupsToCreate);
    }
  }

  /**
   * Fallback method to create groups individually
   */
  private static async createGroupsIndividually(groups: GlobalSettingGroup[]): Promise<void> {
    for (const group of groups) {
      try {
        await this.createGroup(group);
      } catch {
        // Silently continue on error
      }
    }
  }

  /**
   * Check if a group exists
   */
  private static async groupExists(groupId: string): Promise<boolean> {
    try {
      const db = getDb();
      const schema = getSchema();
      
      // Check if database is available
      if (!db) {
        return false;
      }
      
      const globalSettingGroupsTable = schema.globalSettingGroups;
      if (!globalSettingGroupsTable) {
        return false;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await (db as any)
        .select({ id: globalSettingGroupsTable.id })
        .from(globalSettingGroupsTable)
        .where(eq(globalSettingGroupsTable.id, groupId))
        .limit(1);

      return results.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Create a group in the database
   */
  private static async createGroup(group: GlobalSettingGroup): Promise<void> {
    try {
      const db = getDb();
      const schema = getSchema();
      
      // Check if database is available
      if (!db) {
        throw new Error(`Database not available during group creation for: ${group.id}`);
      }
      
      const globalSettingGroupsTable = schema.globalSettingGroups;
      if (!globalSettingGroupsTable) {
        throw new Error('GlobalSettingGroups table not found in schema');
      }

      const now = new Date();
      const groupData = {
        id: group.id,
        name: group.name,
        description: group.description || null,
        icon: group.icon || null,
        sort_order: group.sort_order || 0,
        created_at: now,
        updated_at: now,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .insert(globalSettingGroupsTable)
        .values(groupData);

    } catch (error) {
      throw new Error(`Failed to create group '${group.id}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create settings using batch operations (non-destructive)
   */
  private static async createSettingsBatch(allSettings: GlobalSettingDefinition[], result: InitializationResult): Promise<void> {
    // Check which settings need to be created
    const settingsToCreate: Array<{
      setting: GlobalSettingDefinition;
      groupId: string | null;
    }> = [];

    for (const setting of allSettings) {
      try {
        const exists = await GlobalSettingsService.exists(setting.key);
        if (!exists) {
          const groupIdForThisSetting = this.getGroupIdForSetting(setting.key);
          settingsToCreate.push({
            setting,
            groupId: groupIdForThisSetting === 'unknown' ? null : groupIdForThisSetting
          });
          result.createdSettings.push(setting.key);
        } else {
          result.skippedSettings.push(setting.key);
        }
      } catch {
        // Silently continue on error
      }
    }

    if (settingsToCreate.length === 0) {
      result.skipped = allSettings.length;
      return;
    }

    // Create settings using database-specific batch operations
    try {
      await this.executeBatchSettingsCreation(settingsToCreate);

      result.created = settingsToCreate.length;
      result.skipped = allSettings.length - settingsToCreate.length;
      
      } catch (error) {
        throw error; // Re-throw to trigger fallback
      }
  }

  /**
   * Fallback method to create settings individually
   */
  private static async createSettingsIndividually(allSettings: GlobalSettingDefinition[], result: InitializationResult): Promise<void> {
    for (const setting of allSettings) {
      try {
        const exists = await GlobalSettingsService.exists(setting.key);

        if (!exists) {
          const groupIdForThisSetting = this.getGroupIdForSetting(setting.key);
          await GlobalSettingsService.setTyped(setting.key, setting.defaultValue, setting.type, {
            name: setting.name,
            description: setting.description,
            encrypted: setting.encrypted,
            group_id: groupIdForThisSetting === 'unknown' ? undefined : groupIdForThisSetting
          });

          result.created++;
          result.createdSettings.push(setting.key);
        } else {
          result.skipped++;
          result.skippedSettings.push(setting.key);
        }
      } catch {
        // Silently continue on error
      }
    }
  }

  /**
   * Update existing settings with metadata (name) from definitions
   * This ensures settings created before the name field was added get updated
   */
  private static async updateSettingsMetadata(allSettings: GlobalSettingDefinition[]): Promise<void> {
    const db = getDb();
    const schema = getSchema();

    if (!db) {
      return;
    }

    for (const setting of allSettings) {
      try {
        // Get the current setting from database
        const existingSetting = await GlobalSettingsService.get(setting.key);

        // If setting exists but has no name, update it with the name from definition
        if (existingSetting && !existingSetting.name && setting.name) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db as any)
            .update(schema.globalSettings)
            .set({
              name: setting.name,
              updated_at: new Date()
            })
            .where(eq(schema.globalSettings.key, setting.key));
        }
      } catch {
        // Silently continue on error
      }
    }
  }

  /**
   * Universal batch wrapper that works across all database types
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async universalBatch(operations: any[]): Promise<any[]> {
    try {
      const db = getDb();
      
      if (!db) {
        throw new Error('Database not available during batch operation');
      }

      // For D1, we need to execute operations sequentially due to our HTTP client implementation
      // The D1 HTTP client doesn't support true batch operations
      const results = [];
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        
        try {
          const result = await operation;
          results.push(result);
        } catch (error) {
          throw error;
        }
      }
      
      return results;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute batch group creation using universal batch wrapper
   */
  private static async executeBatchGroupCreation(groupsToCreate: GlobalSettingGroup[]): Promise<void> {
    try {
      const db = getDb();
      const schema = getSchema();
      
      if (!db) {
        throw new Error('Database not available during group creation');
      }
      
      const globalSettingGroupsTable = schema.globalSettingGroups;
      
      if (!globalSettingGroupsTable) {
        throw new Error('GlobalSettingGroups table not found in schema');
      }

      const now = new Date();
      const groupsData = groupsToCreate.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description || null,
        icon: group.icon || null,
        sort_order: group.sort_order || 0,
        created_at: now,
        updated_at: now,
      }));

      // Use universal batch wrapper
      await this.universalBatch([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (db as any).insert(globalSettingGroupsTable).values(groupsData)
      ]);
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute batch settings creation using universal batch wrapper with D1 parameter limits
   */
  private static async executeBatchSettingsCreation(settingsToCreate: Array<{
    setting: GlobalSettingDefinition;
    groupId: string | null;
  }>): Promise<void> {
    const db = getDb();
    const schema = getSchema();
    
    if (!db) {
      throw new Error('Database not available during settings creation');
    }

    const { encrypt } = await import('../utils/encryption');
    const now = new Date();
    
    const settingsData = settingsToCreate.map(({ setting, groupId }) => {
      const stringValue = String(setting.defaultValue);
      const finalValue = setting.encrypted ? encrypt(stringValue) : stringValue;

      return {
        key: setting.key,
        name: setting.name || null,
        value: finalValue,
        type: setting.type,
        description: setting.description || null,
        is_encrypted: setting.encrypted || false,
        group_id: groupId,
        created_at: now,
        updated_at: now,
      };
    });

    // D1 has a parameter limit of around 100-120 parameters per query
    // Each setting has 8 columns, so we can safely batch ~12 settings at a time (96 parameters)
    const BATCH_SIZE = 10; // Conservative batch size to stay well under D1's limits
    
    // Split settings into smaller batches
    const batches = [];
    for (let i = 0; i < settingsData.length; i += BATCH_SIZE) {
      batches.push(settingsData.slice(i, i + BATCH_SIZE));
    }
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        await this.universalBatch([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (db as any).insert(schema.globalSettings).values(batch)
        ]);
      } catch (error) {
        throw error;
      }
    }
  }

  /**
   * Get the group ID for a setting key
   */
  private static getGroupIdForSetting(key: string): string {
    for (const module of this.settingsModules) {
      if (module.settings.some(s => s.key === key)) {
        return module.group.id;
      }
    }
    return 'unknown';
  }

  /**
   * Validate that all required settings have non-empty values
   */
  static async validateRequiredSettings(): Promise<ValidationResult> {
    if (!this.isLoaded) {
      await this.loadSettingsDefinitions();
    }

    const allSettings = this.getAllSettings();
    const requiredSettings = allSettings.filter(s => s.required);
    const missing: string[] = [];
    const groups: Record<string, { total: number; missing: number; missingKeys: string[] }> = {};

    // Initialize groups
    for (const module of this.settingsModules) {
      groups[module.group.id] = {
        total: module.settings.filter(s => s.required).length,
        missing: 0,
        missingKeys: []
      };
    }

    for (const setting of requiredSettings) {
      try {
        const dbSetting = await GlobalSettingsService.get(setting.key);
        const groupId = this.getGroupIdForSetting(setting.key);
        
        if (!dbSetting || !dbSetting.value || dbSetting.value.trim() === '') {
          missing.push(setting.key);
          if (groups[groupId]) {
            groups[groupId].missing++;
            groups[groupId].missingKeys.push(setting.key);
          }
        }
      } catch {
        missing.push(setting.key);
        const groupId = this.getGroupIdForSetting(setting.key);
        if (groups[groupId]) {
          groups[groupId].missing++;
          groups[groupId].missingKeys.push(setting.key);
        }
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      groups
    };
  }

  /**
   * Get complete SMTP configuration
   */
  static async getSmtpConfiguration(): Promise<SmtpConfig | null> {
    try {
      const settings = await Promise.all([
        GlobalSettingsService.get('smtp.host'),
        GlobalSettingsService.get('smtp.port'),
        GlobalSettingsService.get('smtp.username'),
        GlobalSettingsService.get('smtp.password'),
        GlobalSettingsService.get('smtp.secure'),
        GlobalSettingsService.get('smtp.from_name'),
        GlobalSettingsService.get('smtp.from_email')
      ]);

      const [host, port, username, password, secure, fromName, fromEmail] = settings;

      // Check if required settings are present
      if (!host?.value || !port?.value || !username?.value || !password?.value) {
        return null;
      }

      return {
        host: host.value,
        port: parseInt(port.value, 10),
        username: username.value,
        password: password.value,
        secure: secure?.value === 'true',
        fromName: fromName?.value || 'DeployStack',
        fromEmail: fromEmail?.value || ''
      };
    } catch {
      return null;
    }
  }

  /**
   * Get complete GitHub OAuth configuration
   */
  static async getGitHubOAuthConfiguration(): Promise<GitHubOAuthConfig | null> {
    try {
      const settings = await Promise.all([
        GlobalSettingsService.get('github.oauth.client_id'),
        GlobalSettingsService.get('github.oauth.client_secret'),
        GlobalSettingsService.get('github.oauth.enabled'),
        GlobalSettingsService.get('github.oauth.callback_url'),
        GlobalSettingsService.get('github.oauth.scope')
      ]);

      const [clientId, clientSecret, enabled, callbackUrl, scope] = settings;

      // Check if OAuth is enabled and has required settings
      if (enabled?.value !== 'true' || !clientId?.value || !clientSecret?.value) {
        return null;
      }

      return {
        clientId: clientId.value,
        clientSecret: clientSecret.value,
        enabled: enabled.value === 'true',
        callbackUrl: callbackUrl?.value || 'http://localhost:3000/api/auth/github/callback',
        scope: scope?.value || 'user:email'
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if SMTP is properly configured
   */
  static async isSmtpConfigured(): Promise<boolean> {
    const config = await this.getSmtpConfiguration();
    return config !== null;
  }

  /**
   * Check if GitHub OAuth is properly configured and enabled
   */
  static async isGitHubOAuthConfigured(): Promise<boolean> {
    const config = await this.getGitHubOAuthConfiguration();
    return config !== null;
  }

  /**
   * Get complete Global configuration
   */
  static async getGlobalConfiguration(): Promise<GlobalConfig | null> {
    try {
      const settings = await Promise.all([
        GlobalSettingsService.get('global.page_url'),
        GlobalSettingsService.get('smtp.enabled'),
        GlobalSettingsService.get('global.enable_login'),
        GlobalSettingsService.get('global.enable_email_registration')
      ]);

      const [pageUrl, sendMail, enableLogin, enableEmailRegistration] = settings;

      return {
        pageUrl: pageUrl?.value || 'http://localhost:5173',
        sendMail: sendMail?.value === 'true',
        enableLogin: enableLogin?.value === 'true',
        enableEmailRegistration: enableEmailRegistration?.value === 'true'
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if email sending is enabled
   */
  static async isEmailSendingEnabled(): Promise<boolean> {
    try {
      const setting = await GlobalSettingsService.get('smtp.enabled');
      return setting?.value === 'true';
    } catch {
      return false; // Default to disabled if there's an error
    }
  }

  /**
   * Get the application page URL
   */
  static async getPageUrl(): Promise<string> {
    try {
      const setting = await GlobalSettingsService.get('global.page_url');
      return setting?.value || 'http://localhost:5173';
    } catch {
      return 'http://localhost:5173'; // Default fallback
    }
  }

  /**
   * Get the application backend URL
   */
  static async getBackendUrl(): Promise<string> {
    try {
      const setting = await GlobalSettingsService.get('global.backend_url');
      return setting?.value || 'http://localhost:3000';
    } catch {
      return 'http://localhost:3000'; // Default fallback
    }
  }

  /**
   * Check if login is enabled (all types: email, GitHub, etc.)
   */
  static async isLoginEnabled(): Promise<boolean> {
    try {
      const setting = await GlobalSettingsService.get('global.enable_login');
      return setting?.value === 'true';
    } catch {
      return true; // Default to enabled if there's an error
    }
  }

  /**
   * Check if email registration is enabled
   */
  static async isEmailRegistrationEnabled(): Promise<boolean> {
    try {
      const setting = await GlobalSettingsService.get('global.enable_email_registration');
      return setting?.value === 'true';
    } catch {
      return true; // Default to enabled if there's an error
    }
  }
}

// Export the helper class
export { GlobalSettings } from './helpers';

// Export the cache class
export { GlobalSettingsCache } from './cache';

// Export types for external use
export type {
  GlobalSettingDefinition,
  GlobalSettingsModule,
  ValidationResult,
  SmtpConfig,
  GitHubOAuthConfig,
  GlobalConfig,
  InitializationResult
};
