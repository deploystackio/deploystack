import { z } from 'zod';

// Database type - PostgreSQL only
export enum DatabaseType {
  PostgreSQL = 'postgresql',
}

// Zod schema for PostgreSQL configuration (internal representation)
export const PostgreSQLInternalConfigSchema = z.object({
  type: z.literal(DatabaseType.PostgreSQL),
  host: z.string(),
  port: z.number(),
  database: z.string(),
  user: z.string(),
  password: z.string(),
  ssl: z.boolean().optional(),
});
export type PostgreSQLInternalConfig = z.infer<typeof PostgreSQLInternalConfigSchema>;

// Database configuration (PostgreSQL only)
export const InternalDbConfigSchema = PostgreSQLInternalConfigSchema;
export type InternalDbConfig = z.infer<typeof InternalDbConfigSchema>;

// Zod schema for the /api/db/setup request body (what the client sends)
export const DbSetupRequestBodySchema = z.object({
  type: z.nativeEnum(DatabaseType),
  // PostgreSQL credentials are provided via environment variables
  // The client only needs to specify the database type
});
export type DbSetupRequestBody = z.infer<typeof DbSetupRequestBodySchema>;

// Schema for the response of /api/db/status
export const DbStatusResponseSchema = z.object({
  configured: z.boolean(),
  initialized: z.boolean(),
  dialect: z.nativeEnum(DatabaseType).nullable(),
});
export type DbStatusResponse = z.infer<typeof DbStatusResponseSchema>;
