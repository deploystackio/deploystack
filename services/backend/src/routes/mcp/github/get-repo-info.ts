import { type FastifyInstance } from 'fastify';

export default async function getRepoInfo(server: FastifyInstance) {
  server.get('/mcp/github/repo-info', {
    schema: {
      tags: ['MCP GitHub Integration'],
      summary: 'Get GitHub repository info',
      description: 'Get repository information from GitHub for MCP server creation/validation'
    }
  }, async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Not implemented yet'
    });
  });
}
