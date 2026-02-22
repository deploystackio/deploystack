import type { FastifyInstance } from 'fastify';
import { GlobalSettingsInitService } from '../../global-settings';

const GITHUB_STATUS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    enabled: { type: 'boolean' },
    configured: { type: 'boolean' }
  },
  required: ['enabled', 'configured']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    error: { type: 'string' }
  },
  required: ['error']
} as const;

export default async function githubStatusRoute(server: FastifyInstance) {
  server.get('/github/status', {
    schema: {
      tags: ['Authentication'],
      summary: 'Check GitHub OAuth status',
      description: 'Returns whether GitHub OAuth is enabled and configured. This endpoint can be used by the frontend to determine whether to show the "Login with GitHub" button.',
      response: {
        200: {
          ...GITHUB_STATUS_RESPONSE_SCHEMA,
          description: 'GitHub OAuth status information'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (_request, reply) => {
    try {
      // Check if GitHub OAuth is configured and enabled
      const githubConfig = await GlobalSettingsInitService.getGitHubOAuthConfiguration();
      const isConfigured = githubConfig !== null;
      const isEnabled = isConfigured && githubConfig.enabled;

      return reply.status(200).send({
        enabled: isEnabled,
        configured: isConfigured
      });
    } catch (error) {
      server.log.error(error, 'Error checking GitHub OAuth status:');
      return reply.status(500).send({
        error: 'Failed to check GitHub OAuth status'
      });
    }
  });
}
