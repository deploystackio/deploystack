import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

// Convert callback-based exec to Promise-based
const exec = promisify(execCallback);

// Generate migrations from the schema
export async function generateMigrations(
  schemaPath: string,
  outDir: string,
) {
  try {
    // This is typically run as a separate command, not at runtime
    const { stdout, stderr } = await exec(
      `npx drizzle-kit generate:sqlite --schema=${schemaPath} --out=${outDir}`
    );
    
    if (stderr) {
      console.error(`Migration stderr: ${stderr}`);
    }
    
    console.log(`Migration stdout: ${stdout}`);
  } catch (error) {
    console.error(`Migration generation error:`, error);
    throw error;
  }
}

// Apply migrations to the database
export async function applyMigrations(dbPath: string, migrationsDir: string) {
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  
  try {
    // Check if migrations directory exists
    await fs.access(migrationsDir);
    
    // Apply migrations
    await migrate(db, { migrationsFolder: migrationsDir });
    console.log('Migrations applied successfully');
  } catch (error) {
    console.error('Failed to apply migrations:', error);
    throw error;
  } finally {
    sqlite.close();
  }
}
