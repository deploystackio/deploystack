import { type FastifyInstance } from 'fastify';

export default async function getServer(server: FastifyInstance) {
  server.get('/mcp/servers/:id', {
    schema: {
      tags: ['MCP Servers'],
      summary: 'Get MCP server by ID',
      description: 'Retrieve a specific MCP server by its ID'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
