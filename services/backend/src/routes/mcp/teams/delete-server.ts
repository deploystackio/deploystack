import { type FastifyInstance } from 'fastify';

export default async function deleteTeamServer(server: FastifyInstance) {
  server.delete('/mcp/teams/:teamId/servers/:serverId', {
    schema: {
      tags: ['MCP Team Servers'],
      summary: 'Delete team MCP server',
      description: 'Delete a team MCP server'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
