import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { McpCategoriesService } from '../../../services/mcpCategoriesService';
import { getDb } from '../../../db';

// Path parameter schema
const updateCategoryParamsSchema = z.object({
  id: z.string().min(1, 'Category ID is required')
});

// Request schema
const updateCategoryRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  sort_order: z.number().int().min(0, 'Sort order must be non-negative').optional()
});

// Response schemas
const updateCategoryResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    sort_order: z.number(),
    created_at: z.string()
  })
});

const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string(),
  details: z.any().optional()
});

export default async function updateCategory(server: FastifyInstance) {
  server.put('/mcp/categories/:id', {
    preHandler: requirePermission('mcp.categories.edit'),
    schema: {
      tags: ['MCP Categories'],
      summary: 'Update MCP category (Admin only)',
      description: 'Update an existing MCP server category - requires global admin permissions. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(updateCategoryParamsSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: zodToJsonSchema(updateCategoryRequestSchema, {
              $refStrategy: 'none',
              target: 'openApi3'
            })
          }
        }
      },
      response: {
        200: zodToJsonSchema(updateCategoryResponseSchema, {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Invalid input or missing Content-Type header'), {
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
        409: zodToJsonSchema(errorResponseSchema.describe('Conflict - Category name already exists'), {
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
    const { id } = request.params as z.infer<typeof updateCategoryParamsSchema>;
    const updateData = request.body as z.infer<typeof updateCategoryRequestSchema>;
    
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

        return reply.status(404).send({
          success: false,
          error: 'Category not found'
        });
      }

      request.log.info({
        operation: 'update_mcp_category',
        userId: request.user?.id,
        categoryId: id,
        categoryName: updatedCategory.name
      }, 'MCP category updated successfully');

      return reply.status(200).send({
        success: true,
        data: {
          ...updatedCategory,
          created_at: updatedCategory.created_at.toISOString()
        }
      });
    } catch (error: any) {
      request.log.error({
        operation: 'update_mcp_category',
        userId: request.user?.id,
        categoryId: id,
        error
      }, 'Failed to update MCP category');

      // Handle specific error cases
      if (error.message?.includes('Category not found')) {
        return reply.status(404).send({
          success: false,
          error: 'Category not found'
        });
      }

      if (error.message?.includes('UNIQUE constraint failed') || error.message?.includes('already exists')) {
        return reply.status(409).send({
          success: false,
          error: 'Category name already exists'
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Failed to update category'
      });
    }
  });
}
