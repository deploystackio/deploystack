import { type FastifyInstance } from 'fastify';

export default async function deleteCategory(server: FastifyInstance) {
  server.delete('/mcp/categories/:id', {
    schema: {
      tags: ['MCP Categories'],
      summary: 'Delete MCP category (Admin only)',
      description: 'Delete an MCP server category - requires global admin permissions'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
