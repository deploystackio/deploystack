import 'fastify'
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { type Database } from 'better-sqlite3'
import { type PluginManager } from '../plugin-system'

declare module 'fastify' {
  interface FastifyInstance {
    db: BetterSQLite3Database
    sqlite: Database
    pluginManager: PluginManager
  }
  
  interface FastifyReply {
    startTime: number;
  }
  
  interface FastifyRequest {
    id: string;
  }
}