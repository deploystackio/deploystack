import fs from 'fs';
import path from 'path';
import { GlobalSettingsService } from '../services/globalSettingsService';
import type { 
  GlobalSettingsModule, 
  GlobalSettingDefinition, 
  GlobalSettingGroup,
  GroupWithSettings,
  CreateGroupInput,
  ValidationResult, 
  SmtpConfig, 
  GitHubOAuthConfig, 
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

    const settingsDir = __dirname;
    const files = fs.readdirSync(settingsDir);
    
    // Filter for .ts/.js files, exclude index and types files
    const settingFiles = files.filter(file => 
      (file.endsWith('.ts') || file.endsWith('.js')) && 
      file !== 'index.ts' && 
      file !== 'index.js' && 
      file !== 'types.ts' && 
      file !== 'types.js'
    );

    console.log(`🔄 Loading global settings definitions...`);
    console.log(`📁 Found ${settingFiles.length} setting files: ${settingFiles.map(f => f.replace(/\.(ts|js)$/, '')).join(', ')}`);

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
            console.log(`✅ Loaded settings module: ${exportedValue.group.id} (${exportedValue.settings.length} settings)`);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to load settings file ${file}:`, error);
      }
    }

    this.isLoaded = true;
    console.log(`🎉 Loaded ${this.settingsModules.length} settings modules with ${this.getAllSettings().length} total settings`);
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
  static async initializeSettings(): Promise<InitializationResult> {
    if (!this.isLoaded) {
      await this.loadSettingsDefinitions();
    }

    // First, create groups
    try {
      await this.createGroups();
    } catch (error) {
      console.error('❌ Failed to create groups, continuing with settings creation:', error);
    }

    const allSettings = this.getAllSettings();
    const result: InitializationResult = {
      totalModules: this.settingsModules.length,
      totalSettings: allSettings.length,
      created: 0,
      skipped: 0,
      createdSettings: [],
      skippedSettings: []
    };

    console.log(`🔄 Initializing ${allSettings.length} global settings...`);

    for (const setting of allSettings) {
      try {
        const exists = await GlobalSettingsService.exists(setting.key);
        
        if (!exists) {
          await GlobalSettingsService.set(setting.key, setting.defaultValue, {
            description: setting.description,
            encrypted: setting.encrypted,
            group_id: undefined // Temporarily set to undefined to avoid foreign key constraint
          });
          
          result.created++;
          result.createdSettings.push(setting.key);
          console.log(`✅ Created setting: ${setting.key}`);
        } else {
          result.skipped++;
          result.skippedSettings.push(setting.key);
          console.log(`⏭️  Skipped existing setting: ${setting.key}`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize setting ${setting.key}:`, error);
      }
    }

    console.log(`🎉 Global settings initialization complete: ${result.created} created, ${result.skipped} skipped`);
    
    // Check for missing required settings
    const validation = await this.validateRequiredSettings();
    if (!validation.valid) {
      console.warn(`⚠️  Missing required settings: ${validation.missing.join(', ')}`);
    }

    return result;
  }

  /**
   * Create groups in the database (non-destructive)
   */
  private static async createGroups(): Promise<void> {
    const groups = this.getGroups();
    
    console.log(`🔄 Creating ${groups.length} setting groups...`);
    
    for (const group of groups) {
      try {
        // Check if group already exists (we'll need to add this method to GlobalSettingsService)
        const exists = await this.groupExists(group.id);
        
        if (!exists) {
          await this.createGroup(group);
          console.log(`✅ Created group: ${group.id} (${group.name})`);
        } else {
          console.log(`⏭️  Skipped existing group: ${group.id}`);
        }
      } catch (error) {
        console.error(`❌ Failed to create group ${group.id}:`, error);
      }
    }
  }

  /**
   * Check if a group exists
   */
  private static async groupExists(groupId: string): Promise<boolean> {
    try {
      const { getDb, getSchema } = await import('../db');
      const { eq } = await import('drizzle-orm');
      const db = getDb();
      const schema = getSchema();
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
    } catch (error) {
      console.error(`Error checking if group exists: ${groupId}`, error);
      return false;
    }
  }

  /**
   * Create a group in the database
   */
  private static async createGroup(group: GlobalSettingGroup): Promise<void> {
    try {
      const { getDb, getSchema } = await import('../db');
      const db = getDb();
      const schema = getSchema();
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
      } catch (error) {
        console.error(`Error validating setting ${setting.key}:`, error);
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
    } catch (error) {
      console.error('Failed to get SMTP configuration:', error);
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
    } catch (error) {
      console.error('Failed to get GitHub OAuth configuration:', error);
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
}

// Export types for external use
export type {
  GlobalSettingDefinition,
  GlobalSettingsModule,
  ValidationResult,
  SmtpConfig,
  GitHubOAuthConfig,
  InitializationResult
};
