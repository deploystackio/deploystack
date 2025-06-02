export interface GlobalSettingDefinition {
  key: string;
  defaultValue: string;
  description: string;
  encrypted: boolean;
  required: boolean;
}

export interface GlobalSettingGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  sort_order: number;
}

export interface GlobalSettingsModule {
  group: GlobalSettingGroup;
  settings: GlobalSettingDefinition[];
}

export interface GroupWithSettings extends GlobalSettingGroup {
  settings: {
    key: string;
    value: string;
    description?: string;
    is_encrypted: boolean;
    created_at: Date;
    updated_at: Date;
  }[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateGroupInput {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  sort_order?: number;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  icon?: string;
  sort_order?: number;
}

export interface ValidationResult {
  valid: boolean;
  missing: string[];
  groups: Record<string, {
    total: number;
    missing: number;
    missingKeys: string[];
  }>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
  fromName: string;
  fromEmail: string;
}

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  enabled: boolean;
  callbackUrl: string;
  scope: string;
}

export interface InitializationResult {
  totalModules: number;
  totalSettings: number;
  created: number;
  skipped: number;
  createdSettings: string[];
  skippedSettings: string[];
}
