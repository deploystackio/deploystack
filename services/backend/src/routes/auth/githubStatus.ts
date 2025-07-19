import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { GlobalSettingsInitService } from '../../global-settings';

// Response schema for GitHub OAuth status
const githubStatusResponseSchema = z.object({
  enabled: z.boolean().describe('Whether GitHub OAuth is enabled and properly configured'),
  configured: z.boolean().describe('Whether GitHub OAuth settings are present (regardless of enabled status)')
});

const errorResponseSchema = z.object({
  error: z.string().describe('Error message')
});

export default async function githubStatusRoute(fastify: FastifyInstance) {
  fastify.get('/github/status', {
    schema: {
      tags: ['Authentication'],
      summary: 'Check GitHub OAuth status',
      description: 'Returns whether GitHub OAuth is enabled and configured. This endpoint can be used by the frontend to determine whether to show the "Login with GitHub" button.',
      response: {
        200: createSchema(githubStatusResponseSchema.describe('GitHub OAuth status information')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
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
      fastify.log.error(error, 'Error checking GitHub OAuth status:');
      return reply.status(500).send({ 
        error: 'Failed to check GitHub OAuth status' 
      });
    }
  });
}
