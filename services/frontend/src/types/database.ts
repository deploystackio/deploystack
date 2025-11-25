export enum DatabaseType {
  PostgreSQL = 'postgresql',
}

export interface DbStatusResponse {
  configured: boolean;
  initialized: boolean;
  dialect: DatabaseType | null;
}

export interface DbSetupRequest {
  type: DatabaseType;
}

export interface DbSetupResponse {
  message: string;
  database_type?: string;
}

export interface DatabaseOption {
  type: DatabaseType;
  name: string;
  subtitle: string;
  description: string;
  features: string[];
  recommended: 'production';
  requiresEnvVars: boolean;
  envVars?: string[];
}

export interface DatabaseState {
  isConfigured: boolean;
  isInitialized: boolean;
  dialect: DatabaseType | null;
  isLoading: boolean;
  error: string | null;
  setupCompleted: boolean;
}
