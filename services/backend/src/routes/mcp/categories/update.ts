import { type FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { McpCategoriesService } from '../../../services/mcpCategoriesService';
import { getDb } from '../../../db';
import { CATEGORY_SCHEMA, CATEGORY_ID_PARAM_SCHEMA, ERROR_RESPONSE_SCHEMA, type Category, type CategoryIdParams, type ErrorResponse } from './schemas';

// Reusable Schema Constants

const UPDATE_CATEGORY_REQUEST_SCHEMA = {
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
      description: 'Sort order for display (must be non-negative)'
    }
  },
  additionalProperties: false
} as const;

const UPDATE_CATEGORY_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates if the category was updated successfully'
    },
    data: CATEGORY_SCHEMA
  },
  required: ['success', 'data']
} as const;

// TypeScript interfaces for type safety
interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  icon?: string;
  sort_order?: number;
}

interface UpdateCategorySuccessResponse {
  success: boolean;
  data: Category;
}

export default async function updateCategory(server: FastifyInstance) {
  server.put('/mcp/categories/:id', {
    preValidation: requirePermission('mcp.categories.edit'),
    schema: {
      tags: ['MCP Categories'],
      summary: 'Update MCP category (Admin only)',
      description: 'Update an existing MCP server category - requires global admin permissions. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schemas
      params: CATEGORY_ID_PARAM_SCHEMA,
      body: UPDATE_CATEGORY_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schemas, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: UPDATE_CATEGORY_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...UPDATE_CATEGORY_SUCCESS_RESPONSE_SCHEMA,
          description: 'Category updated successfully'
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
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Category does not exist'
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
    // TypeScript type assertions (Fastify has already validated)
    const { id } = request.params as CategoryIdParams;
    const updateData = request.body as UpdateCategoryRequest;
    
    request.log.info({
      operation: 'update_mcp_category',
      userId: request.user?.id,
      categoryId: id,
      updateFields: Object.keys(updateData)
    }, 'Updating MCP category');

    try {
      const db = getDb();
      const categoriesService = new McpCategoriesService(db, request.log);
      
      const updatedCategory = await categoriesService.updateCategory(id, updateData);

      if (!updatedCategory) {
        request.log.warn({
          operation: 'update_mcp_category',
          userId: request.user?.id,
          categoryId: id
        }, 'MCP category not found');

        const notFoundResponse: ErrorResponse = {
          success: false,
          error: 'Category not found'
        };
        const jsonString = JSON.stringify(notFoundResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'update_mcp_category',
        userId: request.user?.id,
        categoryId: id,
        categoryName: updatedCategory.name
      }, 'MCP category updated successfully');

      const successResponse: UpdateCategorySuccessResponse = {
        success: true,
        data: {
          id: String(updatedCategory.id),
          name: String(updatedCategory.name),
          description: updatedCategory.description ? String(updatedCategory.description) : null,
          icon: updatedCategory.icon ? String(updatedCategory.icon) : null,
          sort_order: Number(updatedCategory.sort_order),
          created_at: updatedCategory.created_at.toISOString()
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'update_mcp_category',
        userId: request.user?.id,
        categoryId: id,
        error
      }, 'Failed to update MCP category');

      // Handle specific error cases
      if (error.message?.includes('Category not found')) {
        const notFoundResponse: ErrorResponse = {
          success: false,
          error: 'Category not found'
        };
        const jsonString = JSON.stringify(notFoundResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

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
        error: 'Failed to update category'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
