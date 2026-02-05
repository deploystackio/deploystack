import type { FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, and } from 'drizzle-orm';
import { DeploymentGitHubService } from '../../../services/deploymentGitHubService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { GlobalSettings } from '../../../global-settings/helpers';

// Reusable schema constants
const CHECK_STATUS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        current_sha: {
          type: 'string',
          description: 'Currently deployed commit SHA'
        },
        remote_sha: {
          type: 'string',
          description: 'Latest commit SHA from GitHub'
        },
        has_new_commit: {
          type: 'boolean',
          description: 'Whether remote SHA differs from current SHA'
        },
        branch: {
          type: 'string',
          description: 'Git branch name'
        },
        last_deployed_at: {
          type: 'string',
          description: 'Timestamp of last deployment (ISO 8601)'
        }
      },
      required: ['current_sha', 'remote_sha', 'has_new_commit', 'branch', 'last_deployed_at']
    }
  },
  required: ['success', 'data']
} as const;

const REDEPLOY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        server_id: {
          type: 'string',
          description: 'MCP server ID'
        },
        previous_sha: {
          type: 'string',
          description: 'Commit SHA before redeploy'
        },
        new_sha: {
          type: 'string',
          description: 'Latest commit SHA from GitHub'
        },
        instances_notified: {
          type: 'number',
          description: 'Number of satellite instances notified'
        },
        branch: {
          type: 'string',
          description: 'Git branch name'
        }
      },
      required: ['server_id', 'previous_sha', 'new_sha', 'instances_notified', 'branch']
    }
  },
  required: ['success', 'message', 'data']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces
interface CheckStatusParams {
  teamId: string;
  serverId: string;
}

interface CheckStatusResponse {
  success: true;
  data: {
    current_sha: string;
    remote_sha: string;
    has_new_commit: boolean;
    branch: string;
    last_deployed_at: string;
  };
}

interface RedeployParams {
  teamId: string;
  serverId: string;
}

interface RedeployResponse {
  success: true;
  message: string;
  data: {
    server_id: string;
    previous_sha: string;
    new_sha: string;
    instances_notified: number;
    branch: string;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
}

// Server data interface
interface ServerData {
  id: string;
  name: string;
  git_branch: string | null;
  git_commit_sha: string | null;
  repository_url: string | null;
  source: string;
  visibility: string;
  owner_team_id: string | null;
  updated_at: Date | null;
}

// Validation result interface
interface ValidationResult {
  server: ServerData;
  owner: string;
  repo: string;
}

// Helper function to parse GitHub URL
function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
  if (!match) {
    throw new Error('Invalid GitHub URL format');
  }
  return { owner: match[1], repo: match[2] };
}

// Shared validation logic for both endpoints
async function validateGitHubServer(
  db: ReturnType<typeof getDb>,
  schema: ReturnType<typeof getSchema>,
  teamId: string,
  serverId: string
): Promise<ValidationResult> {
  // Step 1: Query server with team filters
  const serverData = await db
    .select({
      id: schema.mcpServers.id,
      name: schema.mcpServers.name,
      git_branch: schema.mcpServers.git_branch,
      git_commit_sha: schema.mcpServers.git_commit_sha,
      repository_url: schema.mcpServers.repository_url,
      source: schema.mcpServers.source,
      visibility: schema.mcpServers.visibility,
      owner_team_id: schema.mcpServers.owner_team_id,
      updated_at: schema.mcpServers.updated_at
    })
    .from(schema.mcpServers)
    .where(
      and(
        eq(schema.mcpServers.id, serverId),
        eq(schema.mcpServers.owner_team_id, teamId),
        eq(schema.mcpServers.visibility, 'team')
      )
    )
    .limit(1);

  if (!serverData || serverData.length === 0) {
    throw {
      status: 404,
      error: 'Server not found or does not belong to this team'
    };
  }

  const server = serverData[0];

  // Step 2: Verify server is GitHub-deployed
  if (server.source !== 'github') {
    throw {
      status: 400,
      error: 'Only GitHub-deployed servers can be redeployed. This server is a catalog server.'
    };
  }

  // Step 3: Verify required fields exist
  if (!server.repository_url) {
    throw {
      status: 400,
      error: 'Server has no repository URL'
    };
  }

  if (!server.git_branch) {
    throw {
      status: 400,
      error: 'Server has no git branch configured'
    };
  }

  // Step 4: Parse GitHub URL
  const { owner, repo } = parseGitHubUrl(server.repository_url);

  return { server, owner, repo };
}

export default async function redeployRoutes(server: FastifyInstance) {
  // GET /api/teams/{teamId}/deploy/github/servers/{serverId}/status
  server.get('/teams/:teamId/deploy/github/servers/:serverId/status', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.servers.deploy')
    ],
    schema: {
      tags: ['Deployment'],
      summary: 'Check GitHub deployment status',
      description: 'Compares deployed commit SHA with latest remote SHA from GitHub. Returns whether a new commit is available for redeployment.',
      security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1 },
          serverId: { type: 'string', minLength: 1 }
        },
        required: ['teamId', 'serverId'],
        additionalProperties: false
      },
      response: {
        200: {
          ...CHECK_STATUS_RESPONSE_SCHEMA,
          description: 'Deployment status'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request (non-GitHub server, missing fields, etc.)'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden (feature disabled, insufficient permissions)'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Server not found or does not belong to team'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error (GitHub API failure, etc.)'
        }
      }
    }
  }, async (request, reply) => {
    // Check if deployment feature is enabled
    const deploymentEnabled = await GlobalSettings.getBoolean('deployment.enabled', false);
    if (!deploymentEnabled) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'GitHub deployment feature is not enabled. Please contact your DeployStack administrator to enable this feature in Global Settings.'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(403).type('application/json').send(jsonString);
    }

    const { teamId, serverId } = request.params as CheckStatusParams;

    request.log.info({
      operation: 'check_deployment_status',
      teamId,
      serverId
    }, 'Checking GitHub deployment status');

    try {
      const db = getDb();
      const schema = getSchema();

      // Validate server (shared validation logic)
      const { server, owner, repo } = await validateGitHubServer(db, schema, teamId, serverId);

      // Fetch latest commit SHA from GitHub
      const githubService = new DeploymentGitHubService(db);
      const remoteSha = await githubService.getLatestCommitSha(
        teamId,
        owner,
        repo,
        server.git_branch!
      );

      const currentSha = server.git_commit_sha || '';
      const hasNewCommit = remoteSha !== currentSha;

      request.log.info({
        serverId,
        currentSha,
        remoteSha,
        hasNewCommit
      }, 'Deployment status checked successfully');

      // Return status
      const successResponse: CheckStatusResponse = {
        success: true,
        data: {
          current_sha: currentSha,
          remote_sha: remoteSha,
          has_new_commit: hasNewCommit,
          branch: server.git_branch!,
          last_deployed_at: server.updated_at?.toISOString() || new Date().toISOString()
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorStatus = (error as any).status || 500;

      request.log.error({
        operation: 'check_deployment_status_failed',
        teamId,
        serverId,
        error: errorMessage,
        stack: errorStack
      }, 'Failed to check deployment status');

      const errorResponse: ErrorResponse = {
        success: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (error as any).error || errorMessage
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(errorStatus).type('application/json').send(jsonString);
    }
  });

  // POST /api/teams/{teamId}/deploy/github/servers/{serverId}/redeploy
  server.post('/teams/:teamId/deploy/github/servers/:serverId/redeploy', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.servers.deploy')
    ],
    schema: {
      tags: ['Deployment'],
      summary: 'Trigger GitHub redeployment',
      description: 'Fetches latest commit SHA from GitHub, updates database, and notifies all satellites to redeploy all team member instances. Allows force restart even if SHA unchanged.',
      security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1 },
          serverId: { type: 'string', minLength: 1 }
        },
        required: ['teamId', 'serverId'],
        additionalProperties: false
      },
      response: {
        200: {
          ...REDEPLOY_RESPONSE_SCHEMA,
          description: 'Redeploy triggered successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request (non-GitHub server, missing fields, etc.)'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden (feature disabled, insufficient permissions)'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Server not found or does not belong to team'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error (GitHub API failure, database error, etc.)'
        }
      }
    }
  }, async (request, reply) => {
    // Check if deployment feature is enabled
    const deploymentEnabled = await GlobalSettings.getBoolean('deployment.enabled', false);
    if (!deploymentEnabled) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'GitHub deployment feature is not enabled. Please contact your DeployStack administrator to enable this feature in Global Settings.'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(403).type('application/json').send(jsonString);
    }

    const { teamId, serverId } = request.params as RedeployParams;

    request.log.info({
      operation: 'github_redeploy_start',
      teamId,
      serverId
    }, 'Starting GitHub redeployment');

    try {
      const db = getDb();
      const schema = getSchema();

      // Validate server (shared validation logic)
      const { server, owner, repo } = await validateGitHubServer(db, schema, teamId, serverId);

      const previousSha = server.git_commit_sha || '';

      // Fetch latest commit SHA from GitHub
      const githubService = new DeploymentGitHubService(db);
      const latestSha = await githubService.getLatestCommitSha(
        teamId,
        owner,
        repo,
        server.git_branch!
      );

      request.log.info({
        serverId,
        previousSha,
        latestSha,
        sameCommit: previousSha === latestSha
      }, 'Fetched latest commit SHA from GitHub');

      // Update database with latest SHA
      await db.update(schema.mcpServers)
        .set({
          git_commit_sha: latestSha,
          updated_at: new Date()
        })
        .where(eq(schema.mcpServers.id, serverId));

      request.log.info({
        serverId,
        newSha: latestSha
      }, 'Updated database with latest commit SHA');

      // Query all instances for this server
      const instances = await db
        .select({
          installation_id: schema.mcpServerInstances.installation_id,
          user_id: schema.mcpServerInstances.user_id
        })
        .from(schema.mcpServerInstances)
        .leftJoin(
          schema.mcpServerInstallations,
          eq(schema.mcpServerInstances.installation_id, schema.mcpServerInstallations.id)
        )
        .where(eq(schema.mcpServerInstallations.server_id, serverId));

      request.log.info({
        serverId,
        instanceCount: instances.length
      }, 'Found instances to notify');

      // Update all instance statuses to 'restarting'
      for (const instance of instances) {
        await db.update(schema.mcpServerInstances)
          .set({
            status: 'restarting',
            status_message: `Redeploying to commit ${latestSha.substring(0, 7)}...`,
            status_updated_at: new Date()
          })
          .where(
            and(
              eq(schema.mcpServerInstances.installation_id, instance.installation_id!),
              eq(schema.mcpServerInstances.user_id, instance.user_id)
            )
          );
      }

      request.log.info({
        serverId,
        instanceCount: instances.length
      }, 'Updated all instance statuses to restarting');

      // Notify satellites for each instance with redeploy event
      const satelliteCommandService = new SatelliteCommandService(db, request.log);

      for (const instance of instances) {
        await satelliteCommandService.notifyMcpRedeploy(
          instance.installation_id!,
          teamId,
          instance.user_id,
          {
            commit_sha: latestSha,
            branch: server.git_branch!
          }
        );
      }

      request.log.info({
        serverId,
        instanceCount: instances.length
      }, 'Notified all satellites successfully');

      // Return success response
      const successResponse: RedeployResponse = {
        success: true,
        message: 'Redeployment triggered successfully. Satellites have been notified to redeploy all team member instances.',
        data: {
          server_id: serverId,
          previous_sha: previousSha,
          new_sha: latestSha,
          instances_notified: instances.length,
          branch: server.git_branch!
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorStatus = (error as any).status || 500;

      request.log.error({
        operation: 'github_redeploy_failed',
        teamId,
        serverId,
        error: errorMessage,
        stack: errorStack
      }, 'GitHub redeployment failed');

      const errorResponse: ErrorResponse = {
        success: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (error as any).error || errorMessage
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(errorStatus).type('application/json').send(jsonString);
    }
  });
}
