import { type FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { sql } from 'drizzle-orm';
import {
  GET_LANGUAGES_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type GetLanguagesSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getLanguages(server: FastifyInstance) {
  server.get('/mcp/servers/languages', {
    preValidation: requirePermission('mcp.servers.read'),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Get all unique programming languages',
      description: 'Retrieve all unique programming languages from MCP servers using DISTINCT query for optimal performance. Results are sorted alphabetically.',
      security: [{ cookieAuth: [] }],
      
      response: {
        200: {
          ...GET_LANGUAGES_SUCCESS_RESPONSE_SCHEMA,
          description: 'Languages retrieved successfully'
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
      operation: 'get_mcp_server_languages',
      userId: request.user?.id
    }, 'Getting unique MCP server languages');

    try {
      const db = getDb();
      const { mcpServers } = getSchema();

      // Use DISTINCT to get unique languages efficiently
      const results = await db
        .selectDistinct({ language: mcpServers.language })
        .from(mcpServers)
        .where(sql`${mcpServers.language} IS NOT NULL AND ${mcpServers.language} != ''`)
        .orderBy(sql`${mcpServers.language} ASC`);

      const languages = results.map((r: { language: string }) => r.language);

      request.log.info({
        operation: 'get_mcp_server_languages',
        userId: request.user!.id,
        uniqueLanguagesCount: languages.length
      }, 'MCP server languages retrieval completed');

      const response: GetLanguagesSuccessResponse = {
        success: true,
        data: {
          languages,
          total: languages.length
        }
      };
      
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'get_mcp_server_languages',
        userId: request.user!.id,
        error
      }, 'Failed to get MCP server languages');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to get MCP server languages'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
