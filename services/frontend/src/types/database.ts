export enum DatabaseType {
  SQLite = 'sqlite',
  Postgres = 'postgres',
}

export interface DbStatusResponse {
  configured: boolean;
  initialized: boolean;
  dialect: DatabaseType | null;
}

export interface DbSetupRequest {
  type: DatabaseType;
  connectionString?: string;
}

export interface DbSetupResponse {
  message: string;
}

export interface DatabaseState {
  isConfigured: boolean;
  isInitialized: boolean;
  dialect: DatabaseType | null;
  isLoading: boolean;
  error: string | null;
  setupCompleted: boolean;
}
