import { type FastifyInstance } from 'fastify';

export default async function createTeamServer(server: FastifyInstance) {
  server.post('/mcp/teams/:teamId/servers', {
    schema: {
      tags: ['MCP Team Servers'],
      summary: 'Create team MCP server',
      description: 'Create a new MCP server for a team'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
