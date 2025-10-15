import { type FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { mcpServers } from '../../../db/schema.sqlite';
import { sql } from 'drizzle-orm';
import {
  GET_RUNTIMES_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type GetRuntimesSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getRuntimes(server: FastifyInstance) {
  server.get('/mcp/servers/runtimes', {
    preValidation: requirePermission('mcp.servers.read'),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Get all unique runtime environments',
      description: 'Retrieve all unique runtime environments from MCP servers using DISTINCT query for optimal performance. Results are sorted alphabetically.',
      security: [{ cookieAuth: [] }],
      
      response: {
        200: {
          ...GET_RUNTIMES_SUCCESS_RESPONSE_SCHEMA,
          description: 'Runtimes retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    request.log.info({
      operation: 'get_mcp_server_runtimes',
      userId: request.user?.id
    }, 'Getting unique MCP server runtimes');

    try {
      const db = getDb();
      
      const results = await db
        .selectDistinct({ runtime: mcpServers.runtime })
        .from(mcpServers)
        .where(sql`${mcpServers.runtime} IS NOT NULL AND ${mcpServers.runtime} != ''`)
        .orderBy(sql`${mcpServers.runtime} ASC`);

      const runtimes = results.map((r: { runtime: string }) => r.runtime);

      request.log.info({
        operation: 'get_mcp_server_runtimes',
        userId: request.user!.id,
        uniqueRuntimesCount: runtimes.length
      }, 'MCP server runtimes retrieval completed');

      const response: GetRuntimesSuccessResponse = {
        success: true,
        data: {
          runtimes,
          total: runtimes.length
        }
      };
      
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'get_mcp_server_runtimes',
        userId: request.user!.id,
        error
      }, 'Failed to get MCP server runtimes');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to get MCP server runtimes'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
