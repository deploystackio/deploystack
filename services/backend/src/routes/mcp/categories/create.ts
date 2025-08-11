import { type FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { McpCategoriesService } from '../../../services/mcpCategoriesService';
import { getDb } from '../../../db';
import { CATEGORY_SCHEMA, ERROR_RESPONSE_SCHEMA, type Category, type ErrorResponse } from './schemas';

// Reusable Schema Constants
const CREATE_CATEGORY_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Name of the category (1-100 characters)'
    },
    description: {
      type: 'string',
      description: 'Optional description of the category'
    },
    icon: {
      type: 'string',
      description: 'Optional icon identifier for the category'
    },
    sort_order: {
      type: 'number',
      minimum: 0,
      description: 'Sort order for display (defaults to 0)'
    }
  },
  required: ['name'],
  additionalProperties: false
} as const;

const CREATE_CATEGORY_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates if the category was created successfully'
    },
    data: CATEGORY_SCHEMA
  },
  required: ['success', 'data']
} as const;

// TypeScript interfaces for type safety
interface CreateCategoryRequest {
  name: string;
  description?: string;
  icon?: string;
  sort_order?: number;
}

interface CreateCategorySuccessResponse {
  success: boolean;
  data: Category;
}

export default async function createCategory(server: FastifyInstance) {
  server.post('/mcp/categories', {
    preValidation: requirePermission('mcp.categories.create'),
    schema: {
      tags: ['MCP Categories'],
      summary: 'Create MCP category (Admin only)',
      description: 'Create a new MCP server category - requires global admin permissions. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      body: CREATE_CATEGORY_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: CREATE_CATEGORY_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        201: {
          ...CREATE_CATEGORY_SUCCESS_RESPONSE_SCHEMA,
          description: 'Category created successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid input or missing Content-Type header'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        },
        409: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Conflict - Category name already exists'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    // TypeScript type assertion (Fastify has already validated)
    const { name, description, icon, sort_order } = request.body as CreateCategoryRequest;
    
    request.log.info({
      operation: 'create_mcp_category',
      userId: request.user?.id,
      categoryName: name,
      sortOrder: sort_order
    }, 'Creating MCP category');

    try {
      const db = getDb();
      const categoriesService = new McpCategoriesService(db, request.log);
      
      const newCategory = await categoriesService.createCategory({
        name,
        description: description,
        icon: icon,
        sort_order: sort_order || 0
      });

      request.log.info({
        operation: 'create_mcp_category',
        userId: request.user?.id,
        categoryId: newCategory.id,
        categoryName: newCategory.name
      }, 'MCP category created successfully');

      const successResponse: CreateCategorySuccessResponse = {
        success: true,
        data: {
          id: String(newCategory.id),
          name: String(newCategory.name),
          description: newCategory.description ? String(newCategory.description) : null,
          icon: newCategory.icon ? String(newCategory.icon) : null,
          sort_order: Number(newCategory.sort_order),
          created_at: newCategory.created_at.toISOString()
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(201).type('application/json').send(jsonString);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'create_mcp_category',
        userId: request.user?.id,
        categoryName: name,
        error
      }, 'Failed to create MCP category');

      // Handle specific error cases
      if (error.message?.includes('UNIQUE constraint failed') || error.message?.includes('already exists')) {
        const conflictResponse: ErrorResponse = {
          success: false,
          error: 'Category name already exists'
        };
        const jsonString = JSON.stringify(conflictResponse);
        return reply.status(409).type('application/json').send(jsonString);
      }

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to create category'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
