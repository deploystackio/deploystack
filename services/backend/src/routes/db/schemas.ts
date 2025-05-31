import { z } from 'zod';

// Enum for database types (SQLite only)
export enum DatabaseType {
  SQLite = 'sqlite',
}

// Zod schema for SQLite configuration (internal representation for setupNewDatabase)
// This matches the DbConfig type from 'src/db/config.ts'
export const SQLiteInternalConfigSchema = z.object({
  type: z.literal(DatabaseType.SQLite),
  dbPath: z.string(), // For internal representation, this will always be the fixed server-side path string
});
export type SQLiteInternalConfig = z.infer<typeof SQLiteInternalConfigSchema>;

// InternalDbConfig is now just SQLite
export const InternalDbConfigSchema = SQLiteInternalConfigSchema;
export type InternalDbConfig = z.infer<typeof InternalDbConfigSchema>;

// Zod schema for the /api/db/setup request body (what the client sends)
export const DbSetupRequestBodySchema = z.object({
  type: z.nativeEnum(DatabaseType),
  // No connectionString needed since we only support SQLite
  // dbPath is not expected from the client for SQLite as it's fixed server-side.
});
export type DbSetupRequestBody = z.infer<typeof DbSetupRequestBodySchema>;

// Schema for the response of /api/db/status
// This matches the structure returned by the original getDbStatus() and sent by the old route
export const DbStatusResponseSchema = z.object({
  configured: z.boolean(),
  initialized: z.boolean(),
  dialect: z.nativeEnum(DatabaseType).nullable(),
});
export type DbStatusResponse = z.infer<typeof DbStatusResponseSchema>;
