import { z } from 'zod';

// Enum for database types (SQLite, Turso)
export enum DatabaseType {
  SQLite = 'sqlite',
  Turso = 'turso',
}

// Zod schema for SQLite configuration (internal representation)
export const SQLiteInternalConfigSchema = z.object({
  type: z.literal(DatabaseType.SQLite),
  dbPath: z.string(), // For internal representation, this will always be the fixed server-side path string
});
export type SQLiteInternalConfig = z.infer<typeof SQLiteInternalConfigSchema>;

// Zod schema for Turso configuration (internal representation)
export const TursoInternalConfigSchema = z.object({
  type: z.literal(DatabaseType.Turso),
  url: z.string(),
  authToken: z.string(),
});
export type TursoInternalConfig = z.infer<typeof TursoInternalConfigSchema>;

// Union of all internal database configurations
export const InternalDbConfigSchema = z.union([
  SQLiteInternalConfigSchema,
  TursoInternalConfigSchema,
]);
export type InternalDbConfig = z.infer<typeof InternalDbConfigSchema>;

// Zod schema for the /api/db/setup request body (what the client sends)
export const DbSetupRequestBodySchema = z.object({
  type: z.nativeEnum(DatabaseType),
  // For Turso, credentials are provided via environment variables
  // The client only needs to specify the database type
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
