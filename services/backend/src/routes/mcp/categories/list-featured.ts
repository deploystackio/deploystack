import { type FastifyInstance } from 'fastify';
import { McpCategoriesService, type FeaturedCategory } from '../../../services/mcpCategoriesService';
import { getDb } from '../../../db';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { ERROR_RESPONSE_SCHEMA, type ErrorResponse } from './schemas';

// Reusable Schema Constants
const FEATURED_CATEGORY_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Unique identifier of the category'
    },
    name: {
      type: 'string',
      description: 'Name of the category'
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Description of the category'
    },
    icon: {
      type: 'string',
      nullable: true,
      description: 'Icon identifier for the category'
    },
    sort_order: {
      type: 'number',
      description: 'Sort order for display'
    },
    featured_server_count: {
      type: 'number',
      description: 'Number of featured MCP servers in this category'
    }
  },
  required: ['id', 'name', 'description', 'icon', 'sort_order', 'featured_server_count']
} as const;

const LIST_FEATURED_CATEGORIES_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates if the categories were retrieved successfully'
    },
    data: {
      type: 'array',
      items: FEATURED_CATEGORY_SCHEMA,
      description: 'Array of MCP server categories that have featured servers'
    }
  },
  required: ['success', 'data']
} as const;

// TypeScript interfaces for type safety
interface ListFeaturedCategoriesSuccessResponse {
  success: boolean;
  data: FeaturedCategory[];
}

export default async function listFeaturedCategories(server: FastifyInstance) {
  server.get('/mcp/categories/featured', {
    preValidation: requirePermission('mcp.servers.read'),
    schema: {
      tags: ['MCP Categories'],
      summary: 'List categories with featured MCP servers',
      description: 'Retrieve all MCP server categories that contain at least one featured global server, including the count of featured servers per category. Requires mcp.servers.read permission.',
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          ...LIST_FEATURED_CATEGORIES_SUCCESS_RESPONSE_SCHEMA,
          description: 'Featured categories retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
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

      const db = getDb();
      const categoriesService = new McpCategoriesService(db, server.log);
      const categories = await categoriesService.getCategoriesWithFeaturedServers();

      request.log.info({
        operation: 'list_featured_categories',
        userId: request.user.id,
        categoriesFound: categories.length
      }, 'Featured categories retrieved');

      const successResponse: ListFeaturedCategoriesSuccessResponse = {
        success: true,
        data: categories
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({
        operation: 'list_featured_categories',
        error
      }, 'Failed to list featured MCP categories');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to retrieve featured categories'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
