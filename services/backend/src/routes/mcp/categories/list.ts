import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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
      description: 'Retrieve all available MCP server categories for organization',
      response: {
        200: zodToJsonSchema(listCategoriesResponseSchema, {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema, {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request, reply) => {
    try {
      const db = getDb();
      const categoriesService = new McpCategoriesService(db, server.log);
      const categories = await categoriesService.getAllCategories();

      return reply.send({
        success: true,
        data: categories.map(cat => ({
          ...cat,
          created_at: cat.created_at.toISOString()
        }))
      });
    } catch (error) {
      server.log.error({
        operation: 'list_categories',
        error
      }, 'Failed to list MCP categories');
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve categories'
      });
    }
  });
}
