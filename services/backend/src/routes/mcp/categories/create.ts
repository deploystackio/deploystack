import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { McpCategoriesService } from '../../../services/mcpCategoriesService';
import { getDb } from '../../../db';

// Request schema
const createCategoryRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().optional(),
  icon: z.string().optional(),
  sort_order: z.number().int().min(0, 'Sort order must be non-negative').optional().default(0)
});

// Response schemas
const createCategoryResponseSchema = z.object({
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

export default async function createCategory(server: FastifyInstance) {
  server.post('/mcp/categories', {
    preValidation: requirePermission('mcp.categories.create'),
    schema: {
      tags: ['MCP Categories'],
      summary: 'Create MCP category (Admin only)',
      description: 'Create a new MCP server category - requires global admin permissions. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      // Plain JSON Schema for Fastify validation
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string' },
          icon: { type: 'string' },
          sort_order: { type: 'number', minimum: 0 }
        },
        required: ['name'],
        additionalProperties: false
      },
      // createSchema() for OpenAPI documentation
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: createSchema(createCategoryRequestSchema)
          }
        }
      },
      response: {
        201: createSchema(createCategoryResponseSchema),
        400: createSchema(errorResponseSchema.describe('Bad Request - Invalid input or missing Content-Type header')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        409: createSchema(errorResponseSchema.describe('Conflict - Category name already exists')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    }
  }, async (request, reply) => {
    const { name, description, icon, sort_order } = request.body as z.infer<typeof createCategoryRequestSchema>;
    
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

      // Manual JSON serialization to avoid serialization issues
      const successResponse = {
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
        const conflictResponse = {
          success: false,
          error: 'Category name already exists'
        };
        const jsonString = JSON.stringify(conflictResponse);
        return reply.status(409).type('application/json').send(jsonString);
      }

      const errorResponse = {
        success: false,
        error: 'Failed to create category'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
