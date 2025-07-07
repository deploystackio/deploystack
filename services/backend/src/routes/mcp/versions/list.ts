import { type FastifyInstance } from 'fastify';

export default async function listVersions(server: FastifyInstance) {
  server.get('/mcp/servers/:serverId/versions', {
    schema: {
      tags: ['MCP Versions'],
      summary: 'List MCP server versions',
      description: 'List all versions/releases for a specific MCP server'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
