import { type FastifyInstance } from 'fastify';

export default async function searchServers(server: FastifyInstance) {
  server.get('/mcp/servers/search', {
    schema: {
      tags: ['MCP Servers'],
      summary: 'Search MCP servers',
      description: 'Search MCP servers by query string'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
