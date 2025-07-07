import { type FastifyInstance } from 'fastify';

export default async function updateGlobalServer(server: FastifyInstance) {
  server.put('/mcp/servers/global/:id', {
    schema: {
      tags: ['MCP Servers'],
      summary: 'Update global MCP server (Admin only)',
      description: 'Update a global MCP server - requires global admin permissions'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
