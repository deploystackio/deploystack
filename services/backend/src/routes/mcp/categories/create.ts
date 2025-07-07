import { type FastifyInstance } from 'fastify';

export default async function createCategory(server: FastifyInstance) {
  server.post('/mcp/categories', {
    schema: {
      tags: ['MCP Categories'],
      summary: 'Create MCP category (Admin only)',
      description: 'Create a new MCP server category - requires global admin permissions'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
