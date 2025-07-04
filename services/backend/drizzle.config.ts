import { defineConfig, type Config } from "drizzle-kit";
import { getDatabaseConfig } from './src/db/config';

// Get database configuration from environment
let dbConfig;
try {
  dbConfig = getDatabaseConfig();
} catch (error) {
  // If no database is configured yet, default to SQLite for drizzle-kit
  console.log('[INFO] No database configured yet, defaulting to SQLite for drizzle-kit');
  dbConfig = {
    type: 'sqlite' as const,
    dbPath: 'persistent_data/database/deploystack.db'
  };
}

let drizzleKitConfig: Config;

switch (dbConfig.type) {
  case 'sqlite':
    drizzleKitConfig = {
      dialect: "sqlite",
      schema: "./src/db/schema.sqlite.ts",
      out: "./drizzle/migrations_sqlite",
      dbCredentials: {
        url: dbConfig.dbPath!
      }
    };
    break;
    
  case 'd1':
    // For D1, we'll handle migrations via our HTTP API implementation
    // Drizzle Kit doesn't directly support D1 HTTP API in this version
    drizzleKitConfig = {
      dialect: "sqlite",
      schema: "./src/db/schema.sqlite.ts", 
      out: "./drizzle/migrations_sqlite"
      // Note: D1 migrations are applied via our custom HTTP client
    };
    break;
    
  case 'turso':
    drizzleKitConfig = {
      dialect: "sqlite", // Turso uses SQLite syntax
      schema: "./src/db/schema.sqlite.ts",
      out: "./drizzle/migrations_sqlite",
      driver: "turso",
      dbCredentials: {
        url: dbConfig.url!,
        authToken: dbConfig.authToken!
      }
    } as Config;
    break;
    
  default:
    throw new Error(`Unsupported database type: ${dbConfig.type}`);
}

console.log(`[INFO] drizzle.config.ts: Using ${dbConfig.type} configuration for drizzle-kit`);

export default defineConfig({
  ...drizzleKitConfig,
  strict: true,
  verbose: true
});
