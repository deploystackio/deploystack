import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { McpCategoriesService } from '../../../services/mcpCategoriesService';
import { getDb } from '../../../db';

// Path parameter schema
const deleteCategoryParamsSchema = z.object({
  id: z.string().min(1, 'Category ID is required')
});

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
      params: zodToJsonSchema(deleteCategoryParamsSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(deleteCategoryResponseSchema, {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Category does not exist'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof deleteCategoryParamsSchema>;
    
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

        return reply.status(404).send({
          success: false,
          error: 'Category not found'
        });
      }

      request.log.info({
        operation: 'delete_mcp_category',
        userId: request.user?.id,
        categoryId: id
      }, 'MCP category deleted successfully');

      return reply.status(200).send({
        success: true,
        message: 'Category deleted successfully'
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'delete_mcp_category',
        userId: request.user?.id,
        categoryId: id,
        error
      }, 'Failed to delete MCP category');

      return reply.status(500).send({
        success: false,
        error: 'Failed to delete category'
      });
    }
  });
}
