/**
 * Database Configuration
 * Environment-based database selection for SQLite and Turso
 */
import type { FastifyBaseLogger } from 'fastify';
import fs from 'fs';
import path from 'path';

// Helper function to check if we're in test mode
function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test';
}

export type DatabaseType = 'sqlite' | 'turso';

export interface DatabaseConfig {
  type: DatabaseType;
  // SQLite specific
  dbPath?: string;
  // Turso specific
  url?: string;
  authToken?: string;
}

/**
 * Get database selection from persistent_data/db.selection.json
 */
function getDatabaseSelection(): { type: DatabaseType } | null {
  try {
    const persistentDataDir = path.join(process.cwd(), 'persistent_data');
    const selectionFile = path.join(persistentDataDir, 'db.selection.json');
    
    if (!fs.existsSync(selectionFile)) {
      return null;
    }
    
    const content = fs.readFileSync(selectionFile, 'utf8');
    const selection = JSON.parse(content);
    
    return {
      type: selection.type as DatabaseType
    };
  } catch {
    return null;
  }
}

/**
 * Get database configuration from selection file or environment variables
 */
export function getDatabaseConfig(logger?: FastifyBaseLogger): DatabaseConfig {
  // First check if there's a database selection file
  const selection = getDatabaseSelection();
  
  let dbType: DatabaseType;
  if (selection) {
    dbType = selection.type;
    if (!isTestMode() && logger) {
      logger.info({
        operation: 'get_database_config',
        source: 'selection_file',
        databaseType: dbType
      }, 'Database type from selection file');
    }
  } else {
    // Fall back to environment variable, but don't default to sqlite
    const envDbType = process.env.DB_TYPE;
    if (!envDbType) {
      throw new Error('No database selection found. Please use the setup endpoint to configure a database.');
    }
    dbType = envDbType as DatabaseType;
    if (!isTestMode() && logger) {
      logger.info({
        operation: 'get_database_config',
        source: 'environment',
        databaseType: dbType
      }, 'Database type from environment');
    }
  }
  
  const config: DatabaseConfig = { type: dbType };
  
  switch (dbType) {
    case 'sqlite':
      if (isTestMode()) {
        const timestamp = Date.now();
        config.dbPath = `persistent_data/database-test/deploystack-${timestamp}.db`;
      } else {
        config.dbPath = process.env.SQLITE_DB_PATH || 'persistent_data/database/deploystack.db';
      }
      break;
      
    case 'turso':
      config.url = process.env.TURSO_DATABASE_URL;
      config.authToken = process.env.TURSO_AUTH_TOKEN;
      
      if (!config.url || !config.authToken) {
        throw new Error('Turso configuration incomplete. Required: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN');
      }
      break;
      
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
  
  if (!isTestMode() && logger) {
    logger.info({
      operation: 'get_database_config',
      databaseType: dbType
    }, 'Database configuration loaded');
  }
  return config;
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): boolean {
  switch (config.type) {
    case 'sqlite':
      return !!config.dbPath;
      
    case 'turso':
      return !!(config.url && config.authToken);
      
    default:
      return false;
  }
}

/**
 * Get database status for API responses
 */
export function getDatabaseStatus(config: DatabaseConfig) {
  return {
    configured: validateDatabaseConfig(config),
    dialect: config.type,
    type: config.type
  };
}
