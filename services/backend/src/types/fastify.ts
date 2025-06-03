import 'fastify'
// Import the new union type for the Drizzle instance
import { type AnyDatabase } from '../db' 
// Import types for raw connections/pools
import type SqliteDriver from 'better-sqlite3'
import { type PluginManager } from '../plugin-system'

declare module 'fastify' {
  interface FastifyInstance {
    // 'db' can now be a Drizzle instance for SQLite or PostgreSQL, or null if not initialized
    db: AnyDatabase | null
    
    // 'rawDbConnection' holds the underlying driver connection (better-sqlite3)
    rawDbConnection: SqliteDriver.Database | null
    
    // The 'sqlite' property is deprecated in favor of 'rawDbConnection' to avoid ambiguity.
    // If some parts of the application still rely on it, it should be:
    // sqlite?: SqliteDriver.Database | null 
    // For now, we remove it to enforce usage of the new property.
    
    pluginManager: PluginManager
    
    // Methods for re-initializing database services after setup
    reinitializeDatabaseServices: () => Promise<boolean>
    reinitializePluginsWithDatabase: () => Promise<void>
  }
  
  interface FastifyReply {
    startTime: number;
  }
  
  interface FastifyRequest {
    id: string;
  }
}
