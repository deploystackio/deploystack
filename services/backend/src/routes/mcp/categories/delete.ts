import { type FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { McpCategoriesService } from '../../../services/mcpCategoriesService';
import { getDb } from '../../../db';
import { CATEGORY_ID_PARAM_SCHEMA, ERROR_RESPONSE_SCHEMA, type CategoryIdParams, type ErrorResponse } from './schemas';

// Reusable Schema Constants

const DELETE_CATEGORY_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates if the category was deleted successfully'
    },
    message: {
      type: 'string',
      description: 'Success message confirming the deletion'
    }
  },
  required: ['success', 'message']
} as const;



// TypeScript interfaces for type safety
interface DeleteCategorySuccessResponse {
  success: boolean;
  message: string;
}

export default async function deleteCategory(server: FastifyInstance) {
  server.delete('/mcp/categories/:id', {
    preValidation: requirePermission('mcp.categories.delete'),
    schema: {
      tags: ['MCP Categories'],
      summary: 'Delete MCP category (Admin only)',
      description: 'Delete an MCP server category - requires global admin permissions. No Content-Type header required for this DELETE request.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      params: CATEGORY_ID_PARAM_SCHEMA,
      
      response: {
        200: {
          ...DELETE_CATEGORY_SUCCESS_RESPONSE_SCHEMA,
          description: 'Category deleted successfully'
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
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    // TypeScript type assertion (Fastify has already validated)
    const { id } = request.params as CategoryIdParams;
    
    request.log.info({
      operation: 'delete_mcp_category',
      userId: request.user?.id,
      categoryId: id
    }, 'Deleting MCP category');

    try {
      const db = getDb();
      const categoriesService = new McpCategoriesService(db, request.log);
      
      const deleted = await categoriesService.deleteCategory(id);

      if (!deleted) {
        request.log.warn({
          operation: 'delete_mcp_category',
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
        operation: 'delete_mcp_category',
        userId: request.user?.id,
        categoryId: id
      }, 'MCP category deleted successfully');

      const successResponse: DeleteCategorySuccessResponse = {
        success: true,
        message: 'Category deleted successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'delete_mcp_category',
        userId: request.user?.id,
        categoryId: id,
        error
      }, 'Failed to delete MCP category');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to delete category'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
