export interface GlobalSettingDefinition {
  key: string;
  defaultValue: string;
  description: string;
  encrypted: boolean;
  required: boolean;
}

export interface GlobalSettingsModule {
  category: string;
  settings: GlobalSettingDefinition[];
}

export interface ValidationResult {
  valid: boolean;
  missing: string[];
  categories: Record<string, {
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
