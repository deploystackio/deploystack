import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { McpCategoriesService } from '../../../services/mcpCategoriesService';
import { getDb } from '../../../db';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';

// Response schema
const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  sort_order: z.number(),
  created_at: z.string()
});

const listCategoriesResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(categorySchema)
});

const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string()
});

export default async function listCategories(server: FastifyInstance) {
  server.get('/mcp/categories', {
    schema: {
      tags: ['MCP Categories'],
      summary: 'List all MCP server categories',
      description: 'Retrieve all available MCP server categories for organization. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires mcp:categories:read scope for OAuth2 access. No Content-Type header required for this GET request.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      response: {
        200: createSchema(listCategoriesResponseSchema),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required or invalid token')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions or scope')),
        500: createSchema(errorResponseSchema)
      }
    },
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:categories:read'),
      requirePermission('mcp.categories.view')
    ]
  }, async (request, reply) => {
    try {
      if (!request.user) {
        const errorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      const authType = request.tokenPayload ? 'oauth2' : 'cookie';
      const userId = request.user.id;

      request.log.debug({
        operation: 'list_mcp_categories',
        userId,
        authType,
        clientId: request.tokenPayload?.clientId,
        scope: request.tokenPayload?.scope,
        endpoint: request.url
      }, 'Authentication method determined for MCP categories listing');

      const db = getDb();
      const categoriesService = new McpCategoriesService(db, server.log);
      const categories = await categoriesService.getAllCategories();

      // Manual JSON serialization to avoid serialization issues
      const successResponse = {
        success: true,
        data: categories.map(cat => ({
          id: String(cat.id),
          name: String(cat.name),
          description: cat.description ? String(cat.description) : null,
          icon: cat.icon ? String(cat.icon) : null,
          sort_order: Number(cat.sort_order),
          created_at: cat.created_at.toISOString()
        }))
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({
        operation: 'list_categories',
        error
      }, 'Failed to list MCP categories');
      
      const errorResponse = {
        success: false,
        error: 'Failed to retrieve categories'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
