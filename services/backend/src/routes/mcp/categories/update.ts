import { type FastifyInstance } from 'fastify';

export default async function updateCategory(server: FastifyInstance) {
  server.put('/mcp/categories/:id', {
    schema: {
      tags: ['MCP Categories'],
      summary: 'Update MCP category (Admin only)',
      description: 'Update an existing MCP server category - requires global admin permissions'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
