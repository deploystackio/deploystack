import 'fastify'
// Import the new union type for the Drizzle instance
import { type AnyDatabase } from '../db'
// Import types for raw connections/pools
import type { Pool } from 'pg'
import { type PluginManager } from '../plugin-system'
import { type DeployStackEventBus } from '../events'
import { type CronManager } from '../cron/cronManager'

declare module 'fastify' {
  interface FastifyInstance {
    // 'db' is a Drizzle instance for PostgreSQL, or null if not initialized
    db: AnyDatabase | null

    // 'rawDbConnection' holds the underlying PostgreSQL connection pool
    rawDbConnection: Pool | null
    
    pluginManager: PluginManager
    
    // Event bus for global event system
    eventBus: DeployStackEventBus
    
    // Methods for re-initializing database services after setup
    reinitializeDatabaseServices: () => Promise<boolean>
    reinitializePluginsWithDatabase: () => Promise<void>
    
    // Cron manager for scheduled jobs
    cronManager?: CronManager
  }
  
  interface FastifyReply {
    startTime: number;
  }
  
  interface FastifyRequest {
    id: string;
  }
}
