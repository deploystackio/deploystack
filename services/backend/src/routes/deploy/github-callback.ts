import type { FastifyInstance } from 'fastify';
import { DeploymentCredentialService } from '../../services/deploymentCredentialService';
import { GlobalSettings } from '../../global-settings/helpers';
import { getDb } from '../../db';

// Reusable schema constants
const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

/**
 * Global GitHub App installation callback route
 *
 * This endpoint handles GitHub App installation callbacks for all teams.
 * GitHub redirects here after user completes app installation.
 *
 * Security: No authentication required (standard OAuth/App callback pattern)
 * CSRF Protection: state parameter contains teamId
 */
export default async function deployGitHubCallbackRoute(server: FastifyInstance) {
  const db = getDb();
  const credentialService = new DeploymentCredentialService(db);

  server.get('/deploy/github/callback', {
    schema: {
      tags: ['Deployment'],
      summary: 'GitHub App installation callback (global)',
      description: 'Handles GitHub App installation callback from any team. No authentication required - this is a public OAuth callback endpoint.',
      querystring: {
        type: 'object',
        properties: {
          installation_id: { type: 'string', minLength: 1 },
          setup_action: { type: 'string' },
          state: { type: 'string', minLength: 1 }
        },
        required: ['installation_id', 'state'],
        additionalProperties: true
      },
      response: {
        302: {
          description: 'Redirect to frontend',
          type: 'null'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Feature disabled'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error - Configuration missing'
        }
      }
    }
  }, async (request, reply) => {
    const { installation_id, state } = request.query as {
      installation_id: string;
      state: string;
      setup_action?: string;
    };

    // Extract teamId from state parameter (CSRF protection)
    const teamId = state;

    server.log.info({
      installation_id,
      teamId,
      operation: 'github_app_installation_callback'
    }, 'GitHub App installation callback received');

    // Get frontend URL for redirects
    const frontendUrl = await GlobalSettings.get('global.page_url');
    if (!frontendUrl) {
      server.log.error({ teamId }, 'Frontend URL not configured (global.page_url)');
      return reply.status(500).send({ error: 'Frontend URL not configured' });
    }

    // Check if deployment feature is enabled
    const deploymentEnabled = await GlobalSettings.getBoolean('deployment.enabled', false);
    if (!deploymentEnabled) {
      server.log.warn({ teamId }, 'GitHub App installation attempted but feature is disabled');
      return reply.redirect(`${frontendUrl}/deploy?error=feature_disabled`);
    }

    try {
      // Store installation ID
      await credentialService.storeInstallation({
        teamId,
        source: 'github',
        installationId: installation_id
      });

      server.log.info({
        installation_id,
        teamId,
        operation: 'github_app_installation_stored'
      }, 'GitHub App installation stored successfully');

      // Redirect to frontend success page
      return reply.redirect(`${frontendUrl}/deploy?installed=true`);
    } catch (error) {
      server.log.error({
        error,
        teamId,
        installation_id,
        operation: 'github_app_installation_failed'
      }, 'GitHub App installation callback failed');

      return reply.redirect(`${frontendUrl}/deploy?error=installation_failed`);
    }
  });
}
