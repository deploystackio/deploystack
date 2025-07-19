import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { McpCategoriesService } from '../../../services/mcpCategoriesService';
import { getDb } from '../../../db';

// Response schema
const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  sort_order: z.number(),
  created_at: z.string()
});

const listCategoriesResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(categorySchema)
});

const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string()
});

export default async function listCategories(server: FastifyInstance) {
  server.get('/mcp/categories', {
    schema: {
      tags: ['MCP Categories'],
      summary: 'List all MCP server categories',
      description: 'Retrieve all available MCP server categories for organization. No Content-Type header required for this GET request.',
      response: {
        200: createSchema(listCategoriesResponseSchema),
        500: createSchema(errorResponseSchema)
      }
    }
  }, async (request, reply) => {
    try {
      const db = getDb();
      const categoriesService = new McpCategoriesService(db, server.log);
      const categories = await categoriesService.getAllCategories();

      // Manual JSON serialization to avoid serialization issues
      const successResponse = {
        success: true,
        data: categories.map(cat => ({
          id: String(cat.id),
          name: String(cat.name),
          description: cat.description ? String(cat.description) : null,
          icon: cat.icon ? String(cat.icon) : null,
          sort_order: Number(cat.sort_order),
          created_at: cat.created_at.toISOString()
        }))
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({
        operation: 'list_categories',
        error
      }, 'Failed to list MCP categories');
      
      const errorResponse = {
        success: false,
        error: 'Failed to retrieve categories'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
