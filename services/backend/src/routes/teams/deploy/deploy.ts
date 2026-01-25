import type { FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { nanoid } from 'nanoid';
import { getDb, getSchema } from '../../../db';
import { eq, or } from 'drizzle-orm';
import { GlobalSettings } from '../../../global-settings/helpers';
import { getGitHubAppConfig } from '../../../lib/deployment/github-config';
import { DeploymentCredentialService } from '../../../services/deploymentCredentialService';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { McpInstanceService } from '../../../services/mcpInstanceService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { TeamService } from '../../../services/teamService';
import { McpSlugService } from '../../../services/mcpCatalogService';
import { EVENT_NAMES } from '../../../events';

// Reusable schema constants
const DEPLOY_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    source: {
      type: 'string',
      enum: ['github'],
      description: 'Deployment source (only GitHub supported currently)'
    },
    repository_url: {
      type: 'string',
      minLength: 1,
      description: 'GitHub repository URL (e.g., https://github.com/user/repo)'
    },
    branch: {
      type: 'string',
      minLength: 1,
      description: 'Git branch to deploy from (e.g., main)'
    },
    satellite_id: {
      type: 'string',
      description: 'Satellite ID to deploy on (optional, uses team default if omitted)'
    },
    team_env: {
      type: 'object',
      description: 'Team-level environment variables',
      additionalProperties: { type: 'string' }
    },
    template_args: {
      type: 'array',
      items: { type: 'string' },
      description: 'Additional command-line arguments for the MCP server'
    }
  },
  required: ['source', 'repository_url', 'branch'],
  additionalProperties: false
} as const;

const DEPLOY_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        installation_id: {
          type: 'string',
          description: 'Installation ID of the created MCP server'
        },
        server_id: {
          type: 'string',
          description: 'Server ID in the MCP catalog'
        },
        commit_sha: {
          type: 'string',
          description: 'Git commit SHA that was deployed'
        }
      },
      required: ['installation_id', 'server_id', 'commit_sha']
    }
  },
  required: ['success', 'data']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' },
    step: { type: 'string', description: 'The validation step that failed (e.g., validate_package_json)' }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces
interface DeployRequest {
  source: 'github';
  repository_url: string;
  branch: string;
  satellite_id?: string;
  team_env?: Record<string, string>;
  template_args?: string[];
}

interface DeploySuccessResponse {
  success: true;
  data: {
    installation_id: string;
    server_id: string;
    commit_sha: string;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  step?: string;
}

// Helper function to parse GitHub URL
function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
  if (!match) {
    throw new Error('Invalid GitHub URL format');
  }
  return { owner: match[1], repo: match[2] };
}

export default async function deployRoutes(server: FastifyInstance) {
  // POST /api/teams/{teamId}/deploy
  server.post('/teams/:teamId/deploy', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.servers.deploy')
    ],
    schema: {
      tags: ['Deployment'],
      summary: 'Deploy MCP server from GitHub (synchronous)',
      description: 'Validates GitHub repository and creates MCP server installation synchronously (2-5 seconds). Returns 201 when installation is created. Frontend then streams logs/status via SSE endpoints. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1 }
        },
        required: ['teamId'],
        additionalProperties: false
      },
      body: DEPLOY_REQUEST_SCHEMA,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: DEPLOY_REQUEST_SCHEMA
          }
        }
      },
      response: {
        201: {
          ...DEPLOY_SUCCESS_RESPONSE_SCHEMA,
          description: 'Deployment created successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Validation error (missing package.json, invalid MCP SDK, etc.)'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden'
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

    const { teamId } = request.params as { teamId: string };
    const userId = request.user!.id;

    const {
      source,
      repository_url,
      branch,
      satellite_id,
      team_env,
      template_args
    } = request.body as DeployRequest;

    // Validate source
    if (source !== 'github') {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Only GitHub source is supported'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(400).type('application/json').send(jsonString);
    }

    request.log.info({
      operation: 'github_deployment_start',
      teamId,
      userId,
      repositoryUrl: repository_url,
      branch
    }, 'Starting synchronous GitHub deployment');

    try {
      const db = getDb();
      const credentialService = new DeploymentCredentialService(db);

      // ============================================
      // STEP 1: Parse GitHub URL
      // ============================================
      let owner: string;
      let repo: string;
      try {
        const parsed = parseGitHubUrl(repository_url);
        owner = parsed.owner;
        repo = parsed.repo;
        request.log.debug({ owner, repo }, 'Parsed GitHub URL');
      } catch {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Invalid GitHub URL format. Expected: https://github.com/owner/repo',
          step: 'parse_github_url'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // ============================================
      // STEP 2: Get GitHub App Installation Token
      // ============================================
      const githubInstallation = await credentialService.getInstallation(teamId, 'github');
      if (!githubInstallation) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team does not have GitHub App installed. Please install the GitHub App first.',
          step: 'check_github_installation'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Generate ephemeral installation access token (1-hour expiry)
      const config = await getGitHubAppConfig();

      const auth = createAppAuth({
        appId: config.appId,
        privateKey: config.privateKey,
        installationId: githubInstallation.installationId
      });

      const { token } = await auth({ type: 'installation' });
      const octokit = new Octokit({ auth: token });

      // ============================================
      // STEP 3: Validate Repository Exists
      // ============================================
      request.log.debug({ owner, repo }, 'Validating repository access');
      try {
        const { data: repoData } = await octokit.rest.repos.get({ owner, repo });

        // Check if repository is empty (no commits)
        if (repoData.size === 0 || !repoData.default_branch) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: `Repository ${owner}/${repo} is empty. Please push code to the repository before deploying.`,
            step: 'validate_repository_not_empty'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: `Repository ${owner}/${repo} not found or not accessible. Ensure the GitHub App has access to this repository.`,
            step: 'validate_repository_access'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
        throw error;
      }

      // ============================================
      // STEP 4: Get Latest Commit SHA
      // ============================================
      request.log.debug({ owner, repo, branch }, 'Fetching latest commit SHA');
      let commitSha: string;
      try {
        const { data: branchData } = await octokit.rest.repos.getBranch({
          owner,
          repo,
          branch
        });
        commitSha = branchData.commit.sha;
        request.log.debug({ commitSha }, 'Fetched commit SHA');
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: `Branch '${branch}' not found in ${owner}/${repo}. Please check the branch name.`,
            step: 'validate_branch_exists'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
        throw error;
      }

      // ============================================
      // STEP 5: Read package.json
      // ============================================
      request.log.debug({ owner, repo, commitSha }, 'Reading package.json');
      let packageJson: {
        name?: string;
        version?: string;
        description?: string;
        license?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      try {
        const { data: packageJsonFile } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: 'package.json',
          ref: commitSha
        });

        if (!('content' in packageJsonFile) || Array.isArray(packageJsonFile)) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'package.json not found in repository root',
            step: 'validate_package_json'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        packageJson = JSON.parse(
          Buffer.from(packageJsonFile.content, 'base64').toString('utf8')
        );
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'package.json not found in repository',
            step: 'validate_package_json'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
        throw error;
      }

      // ============================================
      // STEP 6: Validate MCP SDK Dependency
      // ============================================
      const hasMcpSdk = packageJson.dependencies?.['@modelcontextprotocol/sdk'] ||
                        packageJson.devDependencies?.['@modelcontextprotocol/sdk'];

      if (!hasMcpSdk) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Not a valid MCP server (missing @modelcontextprotocol/sdk dependency)',
          step: 'validate_mcp_sdk'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      request.log.info({ packageName: packageJson.name, version: packageJson.version }, 'Valid MCP server detected');

      // Ensure package.json has required fields
      if (!packageJson.name) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'package.json missing required "name" field',
          step: 'validate_package_json'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // ============================================
      // STEP 7: Create mcpServers Entry
      // ============================================
      const serverId = `srv-github-${nanoid()}`;

      // Generate unique slug using McpSlugService (same as catalog servers)
      const serverSlug = await McpSlugService.generateSlug(
        packageJson.name,
        'team',
        teamId,
        db
      );

      const schema = getSchema();

      try {
        await db.insert(schema.mcpServers).values({
        id: serverId,
        name: packageJson.name,
        official_name: null,
        slug: serverSlug,
        description: packageJson.description || 'GitHub-deployed MCP server',
        long_description: packageJson.description || '',
        version: packageJson.version,
        repository_url: repository_url,
        repository_source: 'github',
        repository_id: null,
        repository_subfolder: null,
        git_branch: branch,
        git_commit_sha: commitSha,
        website_url: null,
        icon_url: null,
        language: 'typescript',
        runtime: 'node',
        transport_type: 'stdio', // Hardcoded for GitHub deployments
        github_account_id: null,
        github_readme_base64: null,
        github_stars: null,
        packages: JSON.stringify([{
          transport: {
            command: 'npx',
            args: ['-y', `github:${owner}/${repo}#${commitSha}`],
            env: {}
          }
        }]),
        remotes: null,
        resources: null,
        prompts: null,
        visibility: 'team',
        owner_team_id: teamId,
        license: packageJson.license || null,
        // Template tier - locked GitHub reference (base args that can't be changed)
        template_args: JSON.stringify([
          { value: '-y', locked: true, description: 'Auto-confirm npx', order: 0 },
          { value: `github:${owner}/${repo}#${commitSha}`, locked: true, description: 'GitHub package reference', order: 1 }
        ]),
        template_env: JSON.stringify([]),
        template_headers: JSON.stringify([]),
        template_url_query_params: JSON.stringify([]),
        // Team tier schema - user-provided args/env during deployment wizard
        team_args_schema: template_args && template_args.length > 0
          ? JSON.stringify(template_args.map((arg, index) => ({
              name: arg,
              type: 'string',
              description: `Team-configurable argument: ${arg}`,
              required: false,
              locked: false,
              default_team_locked: false,
              order: 2 + index // Start after template_args
            })))
          : JSON.stringify([]),
        team_env_schema: team_env && Object.keys(team_env).length > 0
          ? JSON.stringify(Object.keys(team_env).map((key) => ({
              name: key,
              type: 'secret',
              description: `Team environment variable: ${key}`,
              required: true,
              locked: false,
              default_team_locked: false,
              visible_to_users: true
            })))
          : JSON.stringify([]),
        team_headers_schema: JSON.stringify([]),
        team_url_query_params_schema: JSON.stringify([]),
        // User tier schema (empty - no user-level configuration for GitHub servers)
        user_args_schema: JSON.stringify([]),
        user_env_schema: JSON.stringify([]),
        user_headers_schema: JSON.stringify([]),
        user_url_query_params_schema: JSON.stringify([]),
        // Status and source fields
        status: 'active', // Required for satellite config filtering
        source: 'github', // Source type for deletion logic
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date()
      });
      } catch (dbError) {
        request.log.error({
          operation: 'create_mcp_server_failed',
          serverId,
          serverSlug,
          error: dbError,
          errorMessage: dbError instanceof Error ? dbError.message : String(dbError),
          errorStack: dbError instanceof Error ? dbError.stack : undefined
        }, 'Failed to insert into mcpServers table');
        throw dbError;
      }

      request.log.info({ serverId, serverSlug }, 'Created mcpServers entry');

      // Emit MCP_SERVER_CREATED event
      try {
        const eventContext = {
          db: db,
          logger: request.log,
          user: {
            id: userId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            email: (request.user as any).email,
            roleId: 'unknown'
          },
          request: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: request.id
          },
          timestamp: new Date()
        };

        server.eventBus.emitWithContext(
          EVENT_NAMES.MCP_SERVER_CREATED,
          {
            server: {
              id: serverId,
              name: packageJson.name,
              description: packageJson.description || 'GitHub-deployed MCP server',
              language: 'typescript',
              runtime: 'node'
            },
            createdBy: {
              id: userId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email
            },
            metadata: {
              ip: request.ip
            }
          },
          eventContext
        );
        request.log.info(`MCP_SERVER_CREATED event emitted for server: ${serverId}`);
      } catch (eventError) {
        request.log.error(eventError, `Failed to emit MCP_SERVER_CREATED event for server ${serverId}:`);
        // Don't fail deployment if event emission fails
      }

      // ============================================
      // STEP 8: Create Installation (like /installations/create.ts)
      // ============================================

      // Determine satellite_id: use provided value or auto-select
      let satelliteId: string | undefined = satellite_id;

      // If not provided, get team's first available satellite (global or team satellite)
      if (!satelliteId) {
        const { satellites } = getSchema();
        const teamSatellites = await db
          .select({
            id: satellites.id
          })
          .from(satellites)
          .where(
            or(
              eq(satellites.satellite_type, 'global'),
              eq(satellites.team_id, teamId)
            )
          )
          .limit(1);

        satelliteId = teamSatellites.length > 0 ? teamSatellites[0].id : undefined;
      }

      const installationService = new McpInstallationService(db, request.log);
      const mcpInstallation = await installationService.createInstallation(
        teamId,
        userId,
        {
          server_id: serverId,
          installation_name: `GitHub: ${packageJson.name}`,
          installation_type: 'team',
          satellite_id: satelliteId,
          team_args: template_args,
          team_env: team_env,
          team_headers: undefined,
          team_url_query_params: undefined
        }
      );

      request.log.info({ installationId: mcpInstallation.id }, 'Created installation');

      // Emit MCP_INSTALLATION_CREATED event
      try {
        const eventContext = {
          db: db,
          logger: request.log,
          user: {
            id: userId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            email: (request.user as any).email,
            roleId: 'unknown'
          },
          request: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: request.id
          },
          timestamp: new Date()
        };

        server.eventBus.emitWithContext(
          EVENT_NAMES.MCP_INSTALLATION_CREATED,
          {
            installation: {
              id: mcpInstallation.id,
              serverId,
              teamId
            },
            installedBy: {
              id: userId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email
            },
            metadata: {
              ip: request.ip
            }
          },
          eventContext
        );
        request.log.info(`MCP_INSTALLATION_CREATED event emitted for installation: ${mcpInstallation.id}`);
      } catch (eventError) {
        request.log.error(eventError, `Failed to emit MCP_INSTALLATION_CREATED event for installation ${mcpInstallation.id}:`);
        // Don't fail deployment if event emission fails
      }

      // ============================================
      // STEP 9: Create Instances for All Team Members
      // ============================================
      const instanceService = new McpInstanceService(db, request.log);
      const teamMembers = await TeamService.getTeamMembers(teamId);

      for (const member of teamMembers) {
        await instanceService.createInstance(
          mcpInstallation.id,
          member.user_id,
          'provisioning',
          undefined
        );
      }

      request.log.info({ instanceCount: teamMembers.length }, 'Created instances for team members');

      // ============================================
      // STEP 10: Send Configure Commands to Satellites for All Team Members
      // ============================================
      const satelliteCommandService = new SatelliteCommandService(db, request.log);

      // Send command for each team member (matching /mcp/installations/create.ts behavior)
      for (const member of teamMembers) {
        await satelliteCommandService.notifyMcpInstallation(
          mcpInstallation.id,
          teamId,
          member.user_id
        );
      }

      request.log.info({
        installationId: mcpInstallation.id,
        serverId,
        commandCount: teamMembers.length
      }, 'Sent configure commands to satellites for all team members');

      // ============================================
      // STEP 11: Emit MCP_DEPLOYMENT_CREATED Event
      // ============================================
      try {
        const eventContext = {
          db: db,
          logger: request.log,
          user: {
            id: userId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            email: (request.user as any).email,
            roleId: 'unknown'
          },
          request: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: request.id
          },
          timestamp: new Date()
        };

        server.eventBus.emitWithContext(
          EVENT_NAMES.MCP_DEPLOYMENT_CREATED,
          {
            deployment: {
              installationId: mcpInstallation.id,
              serverId,
              commitSha
            },
            deployedBy: {
              id: userId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email
            },
            metadata: {
              ip: request.ip
            }
          },
          eventContext
        );
        request.log.info(`MCP_DEPLOYMENT_CREATED event emitted for installation: ${mcpInstallation.id}`);
      } catch (eventError) {
        request.log.error(eventError, `Failed to emit MCP_DEPLOYMENT_CREATED event for installation ${mcpInstallation.id}:`);
        // Don't fail deployment if event emission fails
      }

      // ============================================
      // STEP 12: Return Success (Installation Created!)
      // ============================================
      const successResponse: DeploySuccessResponse = {
        success: true,
        data: {
          installation_id: mcpInstallation.id,
          server_id: serverId,
          commit_sha: commitSha
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(201).type('application/json').send(jsonString);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      request.log.error({
        operation: 'github_deployment_failed',
        teamId,
        error: errorMessage,
        stack: errorStack
      }, 'GitHub deployment failed');

      const errorResponse: ErrorResponse = {
        success: false,
        error: errorMessage || 'Internal server error during deployment',
        step: 'internal_error'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
