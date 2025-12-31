/* eslint-disable @typescript-eslint/no-explicit-any */
import type { mcpServers } from '../db/schema';

// Infer the type from the Drizzle table definition
type McpServer = typeof mcpServers.$inferSelect;

/**
 * Checks if an MCP server has any required user-level configuration fields
 * across all configuration types (args, env, headers, query params)
 *
 * Accepts both raw McpServer from database (JSON strings) and parsed server objects (arrays)
 */
export function hasRequiredUserConfiguration(server: McpServer | { user_args_schema?: any; user_env_schema?: any; user_headers_schema?: any; user_url_query_params_schema?: any }): boolean {
  const schemas = [
    server.user_args_schema,
    server.user_env_schema,
    server.user_headers_schema,
    server.user_url_query_params_schema
  ];

  for (const schemaData of schemas) {
    if (!schemaData) continue;

    try {
      // Handle both JSON strings (from database) and already-parsed arrays (from service)
      const schema = typeof schemaData === 'string' ? JSON.parse(schemaData) : schemaData;

      if (Array.isArray(schema)) {
        // Check if any field has required: true
        const hasRequired = schema.some((field: any) => field.required === true);
        if (hasRequired) {
          return true;
        }
      }
    } catch {
      // Invalid JSON - skip this schema
      continue;
    }
  }

  return false;
}

/**
 * Gets list of required field names for user-facing error messages
 *
 * Accepts both raw McpServer from database (JSON strings) and parsed server objects (arrays)
 */
export function getRequiredUserFields(server: McpServer | { user_args_schema?: any; user_env_schema?: any; user_headers_schema?: any; user_url_query_params_schema?: any }): string[] {
  const requiredFields: string[] = [];
  const schemas = [
    { data: server.user_args_schema, prefix: 'arg' },
    { data: server.user_env_schema, prefix: 'env' },
    { data: server.user_headers_schema, prefix: 'header' },
    { data: server.user_url_query_params_schema, prefix: 'param' }
  ];

  for (const { data, prefix } of schemas) {
    if (!data) continue;

    try {
      // Handle both JSON strings (from database) and already-parsed arrays (from service)
      const schema = typeof data === 'string' ? JSON.parse(data) : data;

      if (Array.isArray(schema)) {
        schema.forEach((field: any) => {
          if (field.required === true && field.name) {
            requiredFields.push(`${prefix}:${field.name}`);
          }
        });
      }
    } catch {}
  }

  return requiredFields;
}
