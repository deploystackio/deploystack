import { type FastifyInstance } from 'fastify';

export default async function createGlobalServer(server: FastifyInstance) {
  server.post('/mcp/servers/global', {
    schema: {
      tags: ['MCP Servers'],
      summary: 'Create global MCP server (Admin only)',
      description: 'Create a new global MCP server - requires global admin permissions. Will require Content-Type: application/json header when sending request body once implemented.'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
