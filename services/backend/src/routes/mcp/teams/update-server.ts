import { type FastifyInstance } from 'fastify';

export default async function updateTeamServer(server: FastifyInstance) {
  server.put('/mcp/teams/:teamId/servers/:serverId', {
    schema: {
      tags: ['MCP Team Servers'],
      summary: 'Update team MCP server',
      description: 'Update a team MCP server'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
