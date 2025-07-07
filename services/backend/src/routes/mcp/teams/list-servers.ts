import { type FastifyInstance } from 'fastify';

export default async function listTeamServers(server: FastifyInstance) {
  server.get('/mcp/teams/:teamId/servers', {
    schema: {
      tags: ['MCP Team Servers'],
      summary: 'List team MCP servers',
      description: 'List MCP servers for a specific team'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
