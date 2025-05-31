import { defineConfig, type Config } from "drizzle-kit";
import fs from 'fs';
import path from 'path';

interface DbSelection {
  type: 'sqlite';
  dbPath: string;
}

// Function to read config (simplified, synchronous for CLI tool)
function getDbSelectionConfig(): DbSelection | null {
  // Updated path to match the actual location used by the application
  const configPath = path.resolve(__dirname, './persistent_data/db.selection.json'); 
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw) as DbSelection;
    }
    console.log("db.selection.json not found, using default SQLite configuration for drizzle-kit.");
  } catch (e) { 
    console.error("Error reading db.selection.json for drizzle-kit, using default SQLite configuration:", e); 
  }
  return null; // Default to SQLite if no config or error
}

const dbSelection = getDbSelectionConfig();

// Default SQLite configuration
const sqliteDbPath = (dbSelection?.dbPath) 
  ? dbSelection.dbPath 
  : 'persistent_data/database/deploystack.db'; // Default SQLite path

console.log(`[INFO] drizzle.config.ts: Using SQLite dialect for drizzle-kit. DB path: ${sqliteDbPath}`);

const drizzleKitConfig: Config = {
  dialect: "sqlite",
  schema: "./src/db/schema.sqlite.ts", // Point to SQLite-specific schema for drizzle-kit
  out: "./drizzle/migrations_sqlite", // SQLite specific migrations
  dbCredentials: {
    url: path.isAbsolute(sqliteDbPath) ? sqliteDbPath : path.resolve(__dirname, sqliteDbPath),
  },
};

export default defineConfig({
  ...drizzleKitConfig,
  strict: true,
  verbose: true, // Good for debugging drizzle-kit issues
});
