import fs from 'node:fs/promises';
import path from 'node:path';

// Define the path to the configuration file
// Storing it in the 'persistent_data' directory within services/backend
// __dirname is services/backend/src/db, so ../../persistent_data points to services/backend/persistent_data
const CONFIG_DIR = path.join(__dirname, '..', '..', 'persistent_data');
const CONFIG_FILE_PATH = path.join(CONFIG_DIR, 'db.selection.json');

// Helper function to check if we're in test mode
function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test';
}

// Helper function for conditional logging
function logInfo(message: string): void {
  if (!isTestMode()) {
    console.log(message);
  }
}

export interface SQLiteConfig {
  type: 'sqlite';
  dbPath: string; // Relative to services/backend directory
}

export type DbConfig = SQLiteConfig;

/**
 * Reads the database configuration.
 * @returns The database configuration object, or null if not found or error.
 */
export async function getDbConfig(): Promise<DbConfig | null> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true }); // Ensure directory exists
    const data = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
    return JSON.parse(data) as DbConfig;
  } catch (error) {
    // If file not found, it's a valid state (not configured yet)
    // @ts-expect-error - error.code may not be standard on all Node versions but commonly used
    if (error.code === 'ENOENT') {
      return null;
    }
    // For other errors, log and return null
    console.error('[ERROR] Failed to read database configuration:', error);
    return null;
  }
}

/**
 * Saves the database configuration.
 * @param config The database configuration to save.
 */
export async function saveDbConfig(config: DbConfig): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true }); // Ensure directory exists
    const data = JSON.stringify(config, null, 2);
    await fs.writeFile(CONFIG_FILE_PATH, data, 'utf-8');
    logInfo(`[INFO] Database configuration saved to ${CONFIG_FILE_PATH}`);
  } catch (error) {
    console.error('[ERROR] Failed to save database configuration:', error);
    throw error; // Re-throw to indicate failure
  }
}

/**
 * Deletes the database configuration.
 * Useful for resetting the setup.
 */
export async function deleteDbConfig(): Promise<void> {
  try {
    await fs.unlink(CONFIG_FILE_PATH);
    logInfo(`[INFO] Database configuration deleted from ${CONFIG_FILE_PATH}`);
  } catch (error) {
    // @ts-expect-error - error.code
    if (error.code === 'ENOENT') {
      logInfo('[INFO] Database configuration file not found, nothing to delete.');
      return;
    }
    console.error('[ERROR] Failed to delete database configuration:', error);
    throw error;
  }
}
