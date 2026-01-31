import { type FastifyInstance } from 'fastify';
import { McpCategoriesService } from '../../../services/mcpCategoriesService';
import { getDb } from '../../../db';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import { CATEGORY_SCHEMA, ERROR_RESPONSE_SCHEMA, type Category, type ErrorResponse } from './schemas';

// Reusable Schema Constants

const LIST_CATEGORIES_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates if the categories were retrieved successfully'
    },
    data: {
      type: 'array',
      items: CATEGORY_SCHEMA,
      description: 'Array of MCP server categories'
    }
  },
  required: ['success', 'data']
} as const;



// TypeScript interfaces for type safety
interface ListCategoriesSuccessResponse {
  success: boolean;
  data: Category[];
}

export default async function listCategories(server: FastifyInstance) {
  server.get('/mcp/categories', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:categories:read'),
      requirePermission('mcp.categories.view')
    ],
    schema: {
      tags: ['MCP Categories'],
      summary: 'List all MCP server categories',
      description: 'Retrieve all available MCP server categories for organization. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires mcp:categories:read scope for OAuth2 access. No Content-Type header required for this GET request.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      response: {
        200: {
          ...LIST_CATEGORIES_SUCCESS_RESPONSE_SCHEMA,
          description: 'Categories retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required or invalid token'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions or scope'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!request.user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      const authType = request.tokenPayload ? 'oauth2' : 'cookie';
      const userId = request.user.id;

      request.log.trace({
        operation: 'list_mcp_categories',
        userId,
        authType,
        clientId: request.tokenPayload?.clientId,
        scope: request.tokenPayload?.scope,
        endpoint: request.url
      }, 'Authentication method determined for MCP categories listing');

      const db = getDb();
      const categoriesService = new McpCategoriesService(db, server.log);
      const categories = await categoriesService.getAllCategoriesWithServerCount();

      const successResponse: ListCategoriesSuccessResponse = {
        success: true,
        data: categories.map(cat => ({
          id: String(cat.id),
          name: String(cat.name),
          description: cat.description ? String(cat.description) : null,
          icon: cat.icon ? String(cat.icon) : null,
          sort_order: Number(cat.sort_order),
          server_count: Number(cat.server_count),
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
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to retrieve categories'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
