/**
 * Database Configuration
 * PostgreSQL-only configuration for DeployStack backend
 */
import type { FastifyBaseLogger } from 'fastify';
import fs from 'fs';
import path from 'path';

// Helper function to check if we're in test mode
function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test';
}

export type DatabaseType = 'postgresql';

export interface DatabaseConfig {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

/**
 * Get database selection from persistent_data/db.selection.json
 * For backward compatibility with existing installations
 */
function getDatabaseSelection(): { type: string } | null {
  try {
    const persistentDataDir = path.join(process.cwd(), 'persistent_data');
    const selectionFile = path.join(persistentDataDir, 'db.selection.json');

    if (!fs.existsSync(selectionFile)) {
      return null;
    }

    const content = fs.readFileSync(selectionFile, 'utf8');
    const selection = JSON.parse(content);

    return {
      type: selection.type
    };
  } catch {
    return null;
  }
}

/**
 * Get PostgreSQL database configuration from environment variables
 */
export function getDatabaseConfig(logger?: FastifyBaseLogger): DatabaseConfig {
  // Check if there's a database selection file (backward compatibility)
  const selection = getDatabaseSelection();

  if (selection && selection.type !== 'postgresql') {
    if (!isTestMode() && logger) {
      logger.warn({
        operation: 'get_database_config',
        selectedType: selection.type
      }, `Database type '${selection.type}' is no longer supported. DeployStack now requires PostgreSQL. Please reconfigure your database.`);
    }
    throw new Error(`Database type '${selection.type}' is no longer supported. DeployStack now requires PostgreSQL. Please reconfigure your database.`);
  }

  if (!isTestMode() && logger) {
    logger.info({
      operation: 'get_database_config',
      databaseType: 'postgresql'
    }, 'Loading PostgreSQL configuration');
  }

  // Build PostgreSQL configuration from environment variables
  const config: DatabaseConfig = {
    type: 'postgresql',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
    database: process.env.POSTGRES_DATABASE || 'deploystack',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: process.env.POSTGRES_SSL === 'true'
  };

  // Validate required fields
  if (!config.database || !config.user || !config.password) {
    throw new Error('PostgreSQL configuration incomplete. Required environment variables: POSTGRES_DATABASE, POSTGRES_USER, POSTGRES_PASSWORD');
  }

  if (!isTestMode() && logger) {
    logger.info({
      operation: 'get_database_config',
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      ssl: config.ssl
    }, 'PostgreSQL configuration loaded successfully');
  }

  return config;
}

/**
 * Validate PostgreSQL database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): boolean {
  return config.type === 'postgresql' &&
    !!config.host &&
    !!config.port &&
    !!config.database &&
    !!config.user &&
    !!config.password;
}

/**
 * Get database status for API responses
 */
export function getDatabaseStatus(config: DatabaseConfig) {
  return {
    configured: validateDatabaseConfig(config),
    dialect: 'postgresql',
    type: 'postgresql'
  };
}
