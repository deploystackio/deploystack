import type { FastifyInstance } from 'fastify';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { DeploymentGitHubService } from '../../../services/deploymentGitHubService';
import { DeploymentCredentialService } from '../../../services/deploymentCredentialService';
import { getDb } from '../../../db';
import { GlobalSettings } from '../../../global-settings/helpers';

// Reusable schema constants
const CONNECTION_STATUS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    connected: {
      type: 'boolean',
      description: 'Whether the team has connected their GitHub account'
    }
  },
  required: ['connected']
} as const;

const REPOSITORIES_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    repositories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          full_name: { type: 'string' },
          owner: { type: 'string' },
          description: { type: ['string', 'null'] },
          url: { type: 'string' },
          clone_url: { type: 'string' },
          default_branch: { type: 'string' },
          private: { type: 'boolean' },
          updated_at: { type: 'string' }
        }
      }
    }
  },
  required: ['repositories']
} as const;

const DISCONNECT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the disconnection was successful'
    }
  },
  required: ['success']
} as const;

const BRANCHES_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    branches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          commit_sha: { type: 'string' },
          protected: { type: 'boolean' }
        }
      }
    },
    default_branch: {
      type: 'string',
      description: 'Default branch name for the repository'
    }
  },
  required: ['branches', 'default_branch']
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
interface ConnectionStatusResponse {
  connected: boolean;
}

interface RepositoriesResponse {
  repositories: Array<{
    id: number;
    name: string;
    full_name: string;
    owner: string;
    description: string | null;
    url: string;
    clone_url: string;
    default_branch: string;
    private: boolean;
    updated_at: string;
  }>;
}

interface DisconnectResponse {
  success: boolean;
}

interface BranchesResponse {
  branches: Array<{
    name: string;
    commit_sha: string;
    protected: boolean;
  }>;
  default_branch: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function deployGitHubRoutes(server: FastifyInstance) {
  const db = getDb();
  const githubService = new DeploymentGitHubService(db);
  const credentialService = new DeploymentCredentialService(db);

  // GET /api/teams/{teamId}/deploy/github/install
  server.get('/teams/:teamId/deploy/github/install', {
    preValidation: [requireTeamPermission('mcp.servers.deploy')],
    schema: {
      tags: ['Deployment'],
      summary: 'Start GitHub App installation flow',
      description: 'Redirects to GitHub App installation page where user can select repositories',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1 }
        },
        required: ['teamId'],
        additionalProperties: false
      },
      response: {
        302: {
          description: 'Redirect to GitHub App installation',
          type: 'null'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden'
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

    const { teamId } = request.params as { teamId: string };

    const installUrl = await githubService.getInstallationUrl(teamId);

    return reply.redirect(installUrl);
  });

  // GET /api/teams/{teamId}/deploy/github/callback
  server.get('/teams/:teamId/deploy/github/callback', {
    schema: {
      tags: ['Deployment'],
      summary: 'GitHub App installation callback',
      description: 'Handles GitHub App installation callback and stores installation ID',
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
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Feature disabled'
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

    const { teamId } = request.params as { teamId: string };
    const { installation_id, state } = request.query as { installation_id: string; state: string };

    // CSRF protection: verify state matches teamId
    if (state !== teamId) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid state parameter'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(400).type('application/json').send(jsonString);
    }

    try {
      // Store installation ID
      await credentialService.storeInstallation({
        teamId,
        source: 'github',
        installationId: installation_id
      });

      // Redirect to frontend success page
      return reply.redirect(`/deploy?installed=true`);
    } catch (error) {
      server.log.error({ error }, 'GitHub App installation callback failed');
      return reply.redirect(`/deploy?error=installation_failed`);
    }
  });

  // GET /api/teams/{teamId}/deploy/github/connection
  server.get('/teams/:teamId/deploy/github/connection', {
    preValidation: [requireTeamPermission('mcp.servers.deploy')],
    schema: {
      tags: ['Deployment'],
      summary: 'Check GitHub App installation status',
      description: 'Returns whether the team has installed the GitHub App',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1 }
        },
        required: ['teamId'],
        additionalProperties: false
      },
      response: {
        200: {
          ...CONNECTION_STATUS_RESPONSE_SCHEMA,
          description: 'Connection status'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden'
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

    const { teamId } = request.params as { teamId: string };

    const hasInstallation = await credentialService.hasInstallation(teamId, 'github');

    const response: ConnectionStatusResponse = { connected: hasInstallation };
    const jsonString = JSON.stringify(response);
    return reply.status(200).type('application/json').send(jsonString);
  });

  // GET /api/teams/{teamId}/deploy/github/repositories
  server.get('/teams/:teamId/deploy/github/repositories', {
    preValidation: [requireTeamPermission('mcp.servers.deploy')],
    schema: {
      tags: ['Deployment'],
      summary: 'List GitHub repositories',
      description: 'Returns list of repositories accessible to the authenticated GitHub account',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1 }
        },
        required: ['teamId'],
        additionalProperties: false
      },
      response: {
        200: {
          ...REPOSITORIES_RESPONSE_SCHEMA,
          description: 'List of repositories'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'GitHub not connected'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden'
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

    const { teamId } = request.params as { teamId: string };

    try {
      const repositories = await githubService.getUserRepositories(teamId);

      const response: RepositoriesResponse = {
        repositories: repositories.map(repo => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.fullName,
          owner: repo.owner,
          description: repo.description,
          url: repo.url,
          clone_url: repo.cloneUrl,
          default_branch: repo.defaultBranch,
          private: repo.private,
          updated_at: repo.updatedAt
        }))
      };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch repositories'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(400).type('application/json').send(jsonString);
    }
  });

  // GET /api/teams/{teamId}/deploy/github/repositories/{owner}/{repo}/branches
  server.get('/teams/:teamId/deploy/github/repositories/:owner/:repo/branches', {
    preValidation: [requireTeamPermission('mcp.servers.deploy')],
    schema: {
      tags: ['Deployment'],
      summary: 'List branches for a GitHub repository',
      description: 'Returns list of branches for the specified repository',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1 },
          owner: { type: 'string', minLength: 1 },
          repo: { type: 'string', minLength: 1 }
        },
        required: ['teamId', 'owner', 'repo'],
        additionalProperties: false
      },
      response: {
        200: {
          ...BRANCHES_RESPONSE_SCHEMA,
          description: 'List of branches'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad request or repository not found'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden'
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

    const { teamId, owner, repo } = request.params as { teamId: string; owner: string; repo: string };

    try {
      const installation = await credentialService.getInstallation(teamId, 'github');
      if (!installation) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team does not have GitHub App installed'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Generate ephemeral installation token
      const accessToken = await githubService.createInstallationAccessToken(installation.installationId);
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: accessToken });

      // Get repository details for default branch
      const { data: repoData } = await octokit.repos.get({ owner, repo });

      // Check if repository is empty
      if (repoData.size === 0 || !repoData.default_branch) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: `Repository ${owner}/${repo} is empty. Please push code to the repository before deploying.`
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // List branches
      const { data: branches } = await octokit.repos.listBranches({
        owner,
        repo,
        per_page: 100
      });

      const response: BranchesResponse = {
        branches: branches.map(branch => ({
          name: branch.name,
          commit_sha: branch.commit.sha,
          protected: branch.protected
        })),
        default_branch: repoData.default_branch
      };

      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({ error, owner, repo }, 'Failed to fetch branches');
      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch branches'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(400).type('application/json').send(jsonString);
    }
  });

  // POST /api/teams/{teamId}/deploy/github/disconnect
  server.post('/teams/:teamId/deploy/github/disconnect', {
    preValidation: [requireTeamPermission('mcp.servers.deploy')],
    schema: {
      tags: ['Deployment'],
      summary: 'Uninstall GitHub App',
      description: 'Removes the GitHub App installation for the team',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1 }
        },
        required: ['teamId'],
        additionalProperties: false
      },
      response: {
        200: {
          ...DISCONNECT_RESPONSE_SCHEMA,
          description: 'Disconnection result'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden'
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

    const { teamId } = request.params as { teamId: string };

    const deleted = await credentialService.deleteInstallation(teamId, 'github');

    const response: DisconnectResponse = { success: deleted };
    const jsonString = JSON.stringify(response);
    return reply.status(200).type('application/json').send(jsonString);
  });
}
