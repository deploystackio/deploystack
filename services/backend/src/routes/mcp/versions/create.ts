import { type FastifyInstance } from 'fastify';

export default async function createVersion(server: FastifyInstance) {
  server.post('/mcp/servers/:serverId/versions', {
    schema: {
      tags: ['MCP Versions'],
      summary: 'Create MCP server version',
      description: 'Create a new version/release for an MCP server'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
