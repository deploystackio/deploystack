import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type { FastifyBaseLogger } from 'fastify';

// Convert callback-based exec to Promise-based
const exec = promisify(execCallback);

// Helper function to check if we're in test mode
function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test';
}

// Generate migrations from the schema
export async function generateMigrations(
  schemaPath: string,
  outDir: string,
  logger: FastifyBaseLogger
) {
  try {
    // This is typically run as a separate command, not at runtime
    const { stdout, stderr } = await exec(
      `npx drizzle-kit generate:sqlite --schema=${schemaPath} --out=${outDir}`
    );
    
    if (stderr) {
      logger.error({
        operation: 'generate_migrations',
        schemaPath,
        outDir,
        stderr
      }, 'Migration stderr output');
    }
    
    if (!isTestMode()) {
      logger.info({
        operation: 'generate_migrations',
        schemaPath,
        outDir,
        stdout
      }, 'Migration stdout output');
    }
  } catch (error) {
    logger.error({
      operation: 'generate_migrations',
      schemaPath,
      outDir,
      error
    }, 'Migration generation error');
    throw error;
  }
}

// Apply migrations to the database
export async function applyMigrations(dbPath: string, migrationsDir: string, logger: FastifyBaseLogger) {
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  
  try {
    // Check if migrations directory exists
    await fs.access(migrationsDir);
    
    // Apply migrations
    await migrate(db, { migrationsFolder: migrationsDir });
    if (!isTestMode()) {
      logger.info({
        operation: 'apply_migrations',
        dbPath,
        migrationsDir
      }, 'Migrations applied successfully');
    }
  } catch (error) {
    logger.error({
      operation: 'apply_migrations',
      dbPath,
      migrationsDir,
      error
    }, 'Failed to apply migrations');
    throw error;
  } finally {
    sqlite.close();
  }
}
