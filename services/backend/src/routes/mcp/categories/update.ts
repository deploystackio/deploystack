import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
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
    preValidation: requirePermission('mcp.categories.edit'),
    schema: {
      tags: ['MCP Categories'],
      summary: 'Update MCP category (Admin only)',
      description: 'Update an existing MCP server category - requires global admin permissions. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      // Plain JSON Schema for Fastify validation
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string' },
          icon: { type: 'string' },
          sort_order: { type: 'number', minimum: 0 }
        },
        additionalProperties: false
      },
      // createSchema() for OpenAPI documentation
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: createSchema(updateCategoryRequestSchema)
          }
        }
      },
      response: {
        200: createSchema(updateCategoryResponseSchema),
        400: createSchema(errorResponseSchema.describe('Bad Request - Invalid input or missing Content-Type header')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(errorResponseSchema.describe('Not Found - Category does not exist')),
        409: createSchema(errorResponseSchema.describe('Conflict - Category name already exists')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
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

        const notFoundResponse = {
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

      // Manual JSON serialization to avoid serialization issues
      const successResponse = {
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
        const notFoundResponse = {
          success: false,
          error: 'Category not found'
        };
        const jsonString = JSON.stringify(notFoundResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      if (error.message?.includes('UNIQUE constraint failed') || error.message?.includes('already exists')) {
        const conflictResponse = {
          success: false,
          error: 'Category name already exists'
        };
        const jsonString = JSON.stringify(conflictResponse);
        return reply.status(409).type('application/json').send(jsonString);
      }

      const errorResponse = {
        success: false,
        error: 'Failed to update category'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
