import { type FastifyInstance } from 'fastify';

export default async function deleteGlobalServer(server: FastifyInstance) {
  server.delete('/mcp/servers/global/:id', {
    schema: {
      tags: ['MCP Servers'],
      summary: 'Delete global MCP server (Admin only)',
      description: 'Delete a global MCP server - requires global admin permissions'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
