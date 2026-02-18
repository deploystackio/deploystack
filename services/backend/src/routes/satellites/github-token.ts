import { type FastifyInstance } from 'fastify';
import { requireSatelliteAuth } from '../../middleware/satelliteAuthMiddleware';
import { getDb, getSchema } from '../../db';
import { eq, and } from 'drizzle-orm';
import { createAppAuth } from '@octokit/auth-app';

// Reusable Schema Constants
const SATELLITE_ID_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    satelliteId: {
      type: 'string',
      minLength: 1,
      description: 'Satellite ID requesting the token'
    },
    installationId: {
      type: 'string',
      minLength: 1,
      description: 'Installation ID for the GitHub-deployed server'
    }
  },
  required: ['satelliteId', 'installationId'],
  additionalProperties: false
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    token: { type: 'string', description: 'GitHub App installation access token' },
    expires_at: { type: 'string', format: 'date-time', description: 'Token expiration timestamp' }
  },
  required: ['token', 'expires_at']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    error: { type: 'string', description: 'Error message' }
  },
  required: ['error']
} as const;

// TypeScript interfaces
interface PathParams {
  satelliteId: string;
  installationId: string;
}

interface SuccessResponse {
  token: string;
  expires_at: string;
}

interface ErrorResponse {
  error: string;
}

// In-memory token cache: installationId → { token, expiresAt }
const tokenCache = new Map<string, { token: string; expiresAt: Date }>();

// Helper to get GitHub App config from global settings
async function getGitHubAppConfig() {
  const { GlobalSettingsService } = await import('../../services/globalSettingsService');

  const appIdSetting = await GlobalSettingsService.get('deployment.github_app.app_id');
  const privateKeySetting = await GlobalSettingsService.get('deployment.github_app.private_key_base64');

  if (!appIdSetting || !privateKeySetting) {
    throw new Error('GitHub App not configured in global settings');
  }

  const appId = appIdSetting.value;
  const privateKeyBase64 = privateKeySetting.value; // Already decrypted by get()

  // Decode base64 private key
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');

  return {
    appId,
    privateKey
  };
}

export default async function githubTokenRoute(server: FastifyInstance) {
  server.get<{
    Params: PathParams;
    Reply: SuccessResponse | ErrorResponse;
  }>('/satellites/:satelliteId/github-token/:installationId', {
    preValidation: [requireSatelliteAuth()],
    schema: {
      tags: ['Satellites'],
      summary: 'Get GitHub token for deployment',
      description: 'Returns ephemeral GitHub App installation token for satellite to spawn GitHub-deployed servers. Only the satellite running the instance can access its token.',
      params: SATELLITE_ID_PARAM_SCHEMA,
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'GitHub token retrieved successfully'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Satellite not authorized for this installation'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Installation not found or not a GitHub deployment'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Failed to generate GitHub token'
        }
      }
    }
  }, async (request, reply) => {
    const { satelliteId, installationId } = request.params;

    request.log.info({
      operation: 'github_token_request',
      satelliteId,
      installationId
    }, 'Satellite requesting GitHub token');

    try {
      const db = getDb();
      const schema = getSchema();

      // Step 1: Fetch installation + server details
      const results = await db
        .select({
          installation: schema.mcpServerInstallations,
          server: schema.mcpServers,
          satellite: schema.satellites
        })
        .from(schema.mcpServerInstallations)
        .leftJoin(schema.mcpServers, eq(schema.mcpServerInstallations.server_id, schema.mcpServers.id))
        .leftJoin(schema.satellites, eq(schema.satellites.id, satelliteId))
        .where(eq(schema.mcpServerInstallations.id, installationId))
        .limit(1);

      if (results.length === 0 || !results[0].server) {
        request.log.warn({
          operation: 'github_token_not_found',
          satelliteId,
          installationId
        }, 'Installation not found');

        const errorResponse: ErrorResponse = {
          error: 'Installation not found'
        };
        return reply.status(404).send(errorResponse);
      }

      const { installation, server, satellite } = results[0];

      // Step 2: Verify server source is 'github'
      if (server.source !== 'github') {
        request.log.warn({
          operation: 'github_token_wrong_source',
          satelliteId,
          installationId,
          source: server.source
        }, 'Installation is not a GitHub deployment');

        const errorResponse: ErrorResponse = {
          error: 'Installation is not a GitHub deployment'
        };
        return reply.status(404).send(errorResponse);
      }

      // Step 3: Authorization - Check if this satellite can access this installation
      if (!satellite) {
        request.log.error({
          operation: 'github_token_satellite_not_found',
          satelliteId
        }, 'Satellite not found in database');

        const errorResponse: ErrorResponse = {
          error: 'Satellite not found'
        };
        return reply.status(403).send(errorResponse);
      }

      // Authorization logic:
      // - Global satellites: Can access any installation
      // - Team satellites: Can only access their team's installations
      if (satellite.satellite_type === 'team') {
        if (installation.team_id !== satellite.team_id) {
          request.log.warn({
            operation: 'github_token_forbidden',
            satelliteId,
            satelliteTeamId: satellite.team_id,
            installationTeamId: installation.team_id
          }, 'Team satellite cannot access another team\'s installation');

          const errorResponse: ErrorResponse = {
            error: 'Forbidden: Satellite cannot access this installation'
          };
          return reply.status(403).send(errorResponse);
        }
      }

      // Check if satellite is assigned to this installation
      // All instances of an installation run on the same satellite
      if (installation.satellite_id && installation.satellite_id !== satelliteId) {
        request.log.warn({
          operation: 'github_token_wrong_satellite',
          satelliteId,
          installationSatelliteId: installation.satellite_id,
          installationId
        }, 'Installation is running on a different satellite');

        const errorResponse: ErrorResponse = {
          error: 'Forbidden: Installation is running on a different satellite'
        };
        return reply.status(403).send(errorResponse);
      }

      // Step 4: Check token cache (if token exists and valid for >5 minutes)
      const cached = tokenCache.get(installationId);
      if (cached && cached.expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
        request.log.debug({
          operation: 'github_token_cache_hit',
          installationId,
          expiresAt: cached.expiresAt
        }, 'Returning cached GitHub token');

        const successResponse: SuccessResponse = {
          token: cached.token,
          expires_at: cached.expiresAt.toISOString()
        };
        return reply.status(200).send(successResponse);
      }

      // Step 5: Get team's GitHub App installation from deploymentCredentials
      const deploymentCreds = await db
        .select()
        .from(schema.deploymentCredentials)
        .where(
          and(
            eq(schema.deploymentCredentials.team_id, installation.team_id),
            eq(schema.deploymentCredentials.source, 'github'),
            eq(schema.deploymentCredentials.auth_type, 'installation')
          )
        )
        .limit(1);

      if (deploymentCreds.length === 0 || !deploymentCreds[0].installation_id) {
        request.log.info({
          operation: 'github_token_no_installation',
          teamId: installation.team_id
        }, 'No GitHub App credentials found (may be a public repo deployment)');

        const errorResponse: ErrorResponse = {
          error: 'No GitHub App credentials found'
        };
        return reply.status(404).send(errorResponse);
      }

      const githubInstallationId = deploymentCreds[0].installation_id;

      // Step 6: Generate ephemeral GitHub App installation token
      request.log.debug({
        operation: 'github_token_generate',
        installationId,
        githubInstallationId
      }, 'Generating GitHub App installation token');

      const config = await getGitHubAppConfig();

      const auth = createAppAuth({
        appId: config.appId,
        privateKey: config.privateKey,
        installationId: githubInstallationId
      });

      const { token, expiresAt } = await auth({ type: 'installation' });

      // Step 7: Cache token
      const expirationDate = new Date(expiresAt);
      tokenCache.set(installationId, {
        token,
        expiresAt: expirationDate
      });

      request.log.info({
        operation: 'github_token_generated',
        satelliteId,
        installationId,
        expiresAt: expirationDate
      }, 'GitHub token generated and cached');

      const successResponse: SuccessResponse = {
        token,
        expires_at: expirationDate.toISOString()
      };
      return reply.status(200).send(successResponse);

    } catch (error) {
      request.log.error({
        operation: 'github_token_error',
        satelliteId,
        installationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, 'Failed to generate GitHub token');

      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Failed to generate GitHub token'
      };
      return reply.status(500).send(errorResponse);
    }
  });
}
