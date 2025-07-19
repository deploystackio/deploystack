import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { McpCategoriesService } from '../../../services/mcpCategoriesService';
import { getDb } from '../../../db';

// Path parameter schema (type-only)
type DeleteCategoryParams = {
  id: string;
};

// Response schemas
const deleteCategoryResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string(),
  details: z.any().optional()
});

export default async function deleteCategory(server: FastifyInstance) {
  server.delete('/mcp/categories/:id', {
    preValidation: requirePermission('mcp.categories.delete'),
    schema: {
      tags: ['MCP Categories'],
      summary: 'Delete MCP category (Admin only)',
      description: 'Delete an MCP server category - requires global admin permissions. No Content-Type header required for this DELETE request.',
      security: [{ cookieAuth: [] }],
      // Plain JSON Schema for Fastify validation
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 }
        },
        required: ['id']
      },
      response: {
        200: createSchema(deleteCategoryResponseSchema),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(errorResponseSchema.describe('Not Found - Category does not exist')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as DeleteCategoryParams;
    
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

        const notFoundResponse = {
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

      // Manual JSON serialization to avoid serialization issues
      const successResponse = {
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

      const errorResponse = {
        success: false,
        error: 'Failed to delete category'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
