import { defineConfig, type Config } from "drizzle-kit";
import fs from 'fs';
import path from 'path';

interface DbSelection {
  type: 'sqlite' | 'postgres';
  dbPath?: string; // For sqlite
  connectionString?: string; // For postgres
}

// Function to read config (simplified, synchronous for CLI tool)
function getDbSelectionConfig(): DbSelection | null {
  // Assumes drizzle.config.ts is in services/backend/
  const configPath = path.resolve(__dirname, './data/db.selection.json'); 
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw) as DbSelection;
    }
    console.log("db.selection.json not found, defaulting to SQLite for drizzle-kit.");
  } catch (e) { 
    console.error("Error reading db.selection.json for drizzle-kit, defaulting to SQLite:", e); 
  }
  return null; // Default to SQLite if no config or error
}

const dbSelection = getDbSelectionConfig();

let drizzleKitConfig: Config;

if (dbSelection && dbSelection.type === 'postgres' && dbSelection.connectionString) {
  console.log("[INFO] drizzle.config.ts: Using PostgreSQL dialect for drizzle-kit.");
  drizzleKitConfig = {
    dialect: "postgresql",
    schema: "./src/db/schema.pg.ts", // Point to PG-specific schema for drizzle-kit
    out: "./drizzle/migrations_pg", // PostgreSQL specific migrations
    dbCredentials: {
      url: dbSelection.connectionString, // drizzle-kit uses 'url' for PG connection string
    },
  };
} else {
  // Default to SQLite if no config, error, or SQLite selected
  const sqliteDbPath = (dbSelection?.type === 'sqlite' && dbSelection.dbPath) 
    ? dbSelection.dbPath 
    : './data/deploystack.db'; // Default SQLite path

  // Ensure the path used by drizzle-kit for SQLite is relative to `services/backend`
  // If dbPath from config is like "data/deploystack.db", it's already correct.
  // If it's absolute, drizzle-kit might handle it, but relative is safer.
  // For SQLite, `url` should be the file path.
  console.log(`[INFO] drizzle.config.ts: Using SQLite dialect for drizzle-kit. DB path: ${sqliteDbPath}`);
  drizzleKitConfig = {
    dialect: "sqlite",
    schema: "./src/db/schema.sqlite.ts", // Point to SQLite-specific schema for drizzle-kit
    out: "./drizzle/migrations_sqlite", // SQLite specific migrations
    dbCredentials: {
      url: path.isAbsolute(sqliteDbPath) ? sqliteDbPath : path.resolve(__dirname, sqliteDbPath),
    },
  };
}

export default defineConfig({
  ...drizzleKitConfig,
  strict: true,
  verbose: true, // Good for debugging drizzle-kit issues
});
