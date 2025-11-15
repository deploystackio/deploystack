/**
 * MCP Tools Discovered Event Handler
 *
 * Stores discovered tool metadata from MCP server installations in the database
 */

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { FastifyBaseLogger } from 'fastify';
import { mcpToolMetadata } from '../../db/schema.sqlite';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Event type identifier
export const EVENT_TYPE = 'mcp.tools.discovered';

// JSON Schema for Fastify validation
export const SCHEMA = {
  type: 'object',
  properties: {
    installation_id: {
      type: 'string',
      minLength: 1,
      description: 'MCP server installation identifier'
    },
    installation_name: {
      type: 'string',
      minLength: 1,
      description: 'MCP server installation name'
    },
    team_id: {
      type: 'string',
      minLength: 1,
      description: 'Team identifier'
    },
    server_slug: {
      type: 'string',
      minLength: 1,
      description: 'MCP server slug'
    },
    tool_count: {
      type: 'number',
      minimum: 0,
      description: 'Number of tools discovered'
    },
    total_tokens: {
      type: 'number',
      minimum: 0,
      description: 'Total token count for all tools'
    },
    tools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            minLength: 1,
            description: 'Tool name'
          },
          description: {
            type: 'string',
            description: 'Tool description'
          },
          input_schema: {
            type: 'object',
            description: 'JSON Schema for tool inputs'
          },
          token_count: {
            type: 'number',
            minimum: 0,
            description: 'Token count for this tool'
          }
        },
        required: ['tool_name', 'description', 'input_schema', 'token_count']
      },
      description: 'Array of discovered tools'
    },
    discovered_at: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 timestamp when tools were discovered'
    }
  },
  required: ['installation_id', 'installation_name', 'team_id', 'server_slug', 'tool_count', 'total_tokens', 'tools', 'discovered_at'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface ToolMetadata {
  tool_name: string;
  description: string;
  input_schema: object;
  token_count: number;
}

interface ToolsDiscoveredData {
  installation_id: string;
  installation_name: string;
  team_id: string;
  server_slug: string;
  tool_count: number;
  total_tokens: number;
  tools: ToolMetadata[];
  discovered_at: string;
}

/**
 * Handle mcp.tools.discovered event
 *
 * Stores tool metadata in the database using delete-then-insert strategy.
 * This ensures the tool list is always fresh and handles tool removals automatically.
 */
export async function handle(
  satelliteId: string,
  eventData: Record<string, unknown>,
  db: LibSQLDatabase,
  eventTimestamp: Date,
  logger: FastifyBaseLogger
): Promise<void> {
  const data = eventData as unknown as ToolsDiscoveredData;

  logger.info({
    operation: 'process_tool_discovery',
    installation_id: data.installation_id,
    tool_count: data.tool_count,
    total_tokens: data.total_tokens
  }, 'Processing tool discovery event');

  try {
    // Step 1: Delete existing tools for this installation
    await db
      .delete(mcpToolMetadata)
      .where(eq(mcpToolMetadata.installation_id, data.installation_id));

    logger.debug({
      operation: 'delete_existing_tools',
      installation_id: data.installation_id
    }, 'Deleted existing tool metadata');

    // Step 2: Insert new tool records
    if (data.tools.length > 0) {
      const toolRecords = data.tools.map(tool => ({
        id: nanoid(),
        installation_id: data.installation_id,
        team_id: data.team_id,
        tool_name: tool.tool_name,
        description: tool.description || '',
        input_schema: tool.input_schema,
        token_count: tool.token_count,
        discovered_at: eventTimestamp,
        updated_at: eventTimestamp
      }));

      await db.insert(mcpToolMetadata).values(toolRecords);

      logger.info({
        operation: 'store_tool_metadata',
        installation_id: data.installation_id,
        tool_count: data.tools.length,
        total_tokens: data.total_tokens
      }, 'Tool metadata stored successfully');
    } else {
      logger.info({
        operation: 'store_tool_metadata',
        installation_id: data.installation_id,
        tool_count: 0
      }, 'No tools to store for this installation');
    }

  } catch (error) {
    logger.error({
      operation: 'store_tool_metadata_failed',
      installation_id: data.installation_id,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to store tool metadata');

    throw error;
  }
}
