import { type FastifyInstance } from 'fastify';

export default async function updateVersion(server: FastifyInstance) {
  server.put('/mcp/servers/:serverId/versions/:versionId', {
    schema: {
      tags: ['MCP Versions'],
      summary: 'Update MCP server version',
      description: 'Update an existing version/release for an MCP server'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
