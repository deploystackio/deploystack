import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: zodToJsonSchema(createCategoryRequestSchema, {
              $refStrategy: 'none',
              target: 'openApi3'
            })
          }
        }
      },
      response: {
        201: zodToJsonSchema(createCategoryResponseSchema, {
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

      return reply.status(201).send({
        success: true,
        data: {
          ...newCategory,
          created_at: newCategory.created_at.toISOString()
        }
      });
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
        return reply.status(409).send({
          success: false,
          error: 'Category name already exists'
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Failed to create category'
      });
    }
  });
}
