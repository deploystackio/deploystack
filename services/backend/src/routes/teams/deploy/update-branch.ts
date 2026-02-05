import type { FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, and } from 'drizzle-orm';
import { DeploymentGitHubService } from '../../../services/deploymentGitHubService';
import { DeploymentCredentialService } from '../../../services/deploymentCredentialService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { GlobalSettings } from '../../../global-settings/helpers';
import { fetchRepositoryBranches } from '../../../lib/deployment/github-branch-fetcher';

// Reusable schema constants
const UPDATE_BRANCH_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    branch: {
      type: 'string',
      minLength: 1,
      description: 'New branch name to deploy from (e.g., prod, staging)'
    }
  },
  required: ['branch'],
  additionalProperties: false
} as const;

const UPDATE_BRANCH_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        server_id: { type: 'string' },
        previous_branch: { type: 'string' },
        new_branch: { type: 'string' },
        commit_sha: { type: 'string' }
      }
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
interface UpdateBranchRequest {
  branch: string;
}

interface UpdateBranchSuccessResponse {
  success: boolean;
  message: string;
  data: {
    server_id: string;
    previous_branch: string;
    new_branch: string;
    commit_sha: string;
  };
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

// Helper function to parse GitHub URL
function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
  if (!match) {
    throw new Error('Invalid GitHub URL format');
  }
  return { owner: match[1], repo: match[2] };
}

export default async function updateBranchRoutes(server: FastifyInstance) {
  // POST /api/teams/{teamId}/deploy/github/servers/{serverId}/branch
  server.post('/teams/:teamId/deploy/github/servers/:serverId/branch', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.servers.deploy')
    ],
    schema: {
      tags: ['Deployment'],
      summary: 'Update GitHub branch for deployed MCP server',
      description: 'Updates the branch for a GitHub-deployed MCP server and notifies satellites to redeploy. Only team admins can update branches. Only GitHub-deployed servers (source=\'github\') can have their branch updated. Requires Content-Type: application/json header when sending request body.',
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
      body: UPDATE_BRANCH_REQUEST_SCHEMA,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: UPDATE_BRANCH_REQUEST_SCHEMA
          }
        }
      },
      response: {
        200: {
          ...UPDATE_BRANCH_SUCCESS_RESPONSE_SCHEMA,
          description: 'Branch updated successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request (invalid branch, non-GitHub server, catalog server, etc.)'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden (not team admin, feature disabled)'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Server not found or does not belong to team'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
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

    const { teamId, serverId } = request.params as { teamId: string; serverId: string };
    const { branch: newBranch } = request.body as UpdateBranchRequest;

    request.log.info({
      operation: 'github_branch_update_start',
      teamId,
      serverId,
      newBranch
    }, 'Starting GitHub branch update');

    try {
      const db = getDb();
      const schema = getSchema();

      // Step 1: Verify server exists and belongs to team
      const serverData = await db
        .select({
          id: schema.mcpServers.id,
          name: schema.mcpServers.name,
          git_branch: schema.mcpServers.git_branch,
          repository_url: schema.mcpServers.repository_url,
          source: schema.mcpServers.source,
          visibility: schema.mcpServers.visibility,
          owner_team_id: schema.mcpServers.owner_team_id
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
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server not found or does not belong to this team'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const server = serverData[0];

      // Step 2: Verify server is GitHub-deployed
      if (server.source !== 'github') {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Only GitHub-deployed servers can have their branch updated. This server is a catalog server.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Check if branch is already the current one
      if (server.git_branch === newBranch) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: `Server is already deployed on branch '${newBranch}'`
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Step 3: Parse GitHub URL
      const { owner, repo } = parseGitHubUrl(server.repository_url!);

      // Step 4: Get GitHub installation
      const credentialService = new DeploymentCredentialService(db);
      const installation = await credentialService.getInstallation(teamId, 'github');

      if (!installation) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team does not have GitHub App installed. Please install the GitHub App first.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Step 5: Verify branch exists in repository
      const githubService = new DeploymentGitHubService(db);

      try {
        const branchesResult = await fetchRepositoryBranches(
          owner,
          repo,
          installation.installationId,
          githubService
        );

        const branchInfo = branchesResult.branches.find(b => b.name === newBranch);

        if (!branchInfo) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: `Branch '${newBranch}' does not exist in repository ${owner}/${repo}. Available branches: ${branchesResult.branches.map(b => b.name).join(', ')}`
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        // Step 6: Get commit SHA for new branch
        const commitSha = branchInfo.commit_sha;

        request.log.info({
          serverId,
          previousBranch: server.git_branch,
          newBranch,
          commitSha
        }, 'Branch validated successfully');

        // Step 7: Update database
        await db.update(schema.mcpServers)
          .set({
            git_branch: newBranch,
            git_commit_sha: commitSha,
            updated_at: new Date()
          })
          .where(eq(schema.mcpServers.id, serverId));

        request.log.info({
          serverId,
          newBranch,
          commitSha
        }, 'Database updated successfully');

        // Step 8: Notify satellites
        const satelliteCommandService = new SatelliteCommandService(db, request.log);

        // Get all instances for this server via installations
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

        // Send configure command for each user instance
        for (const instance of instances) {
          await satelliteCommandService.notifyMcpInstallation(
            instance.installation_id!,
            teamId,
            instance.user_id
          );
        }

        request.log.info({
          serverId,
          instanceCount: instances.length
        }, 'Satellites notified successfully');

        // Step 9: Return success response
        const successResponse: UpdateBranchSuccessResponse = {
          success: true,
          message: 'Branch updated successfully. Satellites have been notified to redeploy.',
          data: {
            server_id: serverId,
            previous_branch: server.git_branch!,
            new_branch: newBranch,
            commit_sha: commitSha
          }
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (branchError) {
        request.log.error({ error: branchError, owner, repo }, 'Failed to fetch branches from GitHub');
        const errorResponse: ErrorResponse = {
          success: false,
          error: branchError instanceof Error ? branchError.message : 'Failed to fetch branches from GitHub'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      request.log.error({
        operation: 'github_branch_update_failed',
        teamId,
        serverId,
        error: errorMessage,
        stack: errorStack
      }, 'GitHub branch update failed');

      const errorResponse: ErrorResponse = {
        success: false,
        error: errorMessage || 'Internal server error during branch update'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
