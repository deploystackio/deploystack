export enum DatabaseType {
  SQLite = 'sqlite',
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
}

export interface DatabaseState {
  isConfigured: boolean;
  isInitialized: boolean;
  dialect: DatabaseType | null;
  isLoading: boolean;
  error: string | null;
  setupCompleted: boolean;
}
