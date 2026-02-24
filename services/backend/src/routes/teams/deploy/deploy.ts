import type { FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { nanoid } from 'nanoid';
import { getDb, getSchema } from '../../../db';
import { eq, and } from 'drizzle-orm';
import { GlobalSettings } from '../../../global-settings/helpers';
import { DeploymentCredentialService } from '../../../services/deploymentCredentialService';
import { DeploymentValidationService } from '../../../services/deploymentValidationService';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { McpInstanceService } from '../../../services/mcpInstanceService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { TeamService } from '../../../services/teamService';
import { McpSlugService } from '../../../services/mcpCatalogService';
import { SatelliteValidationService } from '../../../services/satelliteValidationService';
import { EVENT_NAMES } from '../../../events';
import { validateArgs, validateEnvVars } from '../../../lib/security';

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
    deployment_source: {
      type: 'string',
      enum: ['github_app', 'github_public'],
      default: 'github_app',
      description: 'Deployment source: github_app (authenticated via GitHub App) or github_public (public repo, no auth)'
    },
    satellite_id: {
      type: 'string',
      description: 'Satellite ID to deploy on (optional, uses team default if omitted)'
    },
    team_env: {
      type: 'array',
      description: 'Team-level environment variables with type information',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          value: { type: 'string' },
          type: { type: 'string', enum: ['string', 'secret', 'boolean'] }
        },
        required: ['name', 'value', 'type'],
        additionalProperties: false
      }
    },
    template_args: {
      type: 'array',
      description: 'Additional command-line arguments for the MCP server with type information',
      items: {
        type: 'object',
        properties: {
          value: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: ['string', 'secret', 'boolean'] }
        },
        required: ['value', 'type'],
        additionalProperties: false
      }
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
interface TypedEnvItem {
  name: string;
  value: string;
  type: 'string' | 'secret' | 'boolean';
}

interface TypedArgItem {
  value: string;
  type: 'string' | 'secret' | 'boolean';
}

interface DeployRequest {
  source: 'github';
  repository_url: string;
  branch: string;
  deployment_source?: 'github_app' | 'github_public';
  satellite_id?: string;
  team_env?: TypedEnvItem[];
  template_args?: TypedArgItem[];
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

// Helper function to parse GitHub URL (for extracting owner/repo for server creation)
function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
  if (!match) {
    throw new Error('Invalid GitHub URL format');
  }
  return { owner: match[1], repo: match[2] };
}

// Type for runtime
type Runtime = 'node' | 'python' | 'go' | 'unknown';

/**
 * Get runtime-specific package manager command for GitHub deployments
 * Node.js uses npx, Python uses uvx
 */
function getPackageManagerConfig(
  runtime: Runtime,
  owner: string,
  repo: string,
  commitSha: string // Still needed for packages.transport.args (legacy)
): {
  command: string;
  args: string[];
  templateArgs: Array<{ value: string; locked: boolean; description: string; order: number }>;
} {
  switch (runtime) {
    case 'node':
      return {
        command: 'npx',
        args: ['-y', `github:${owner}/${repo}#${commitSha}`], // Legacy packages field
        templateArgs: [
          { value: '-y', locked: true, description: 'Auto-confirm npx', order: 0 },
          // CRITICAL FIX: Store owner/repo WITHOUT commitSha
          // Satellite will reconstruct full ref from git_commit_sha field
          { value: `github:${owner}/${repo}`, locked: true, description: 'GitHub repository reference (SHA added dynamically)', order: 1 }
        ]
      };
    case 'python':
      return {
        command: 'uvx',
        args: [`git+https://github.com/${owner}/${repo}.git@${commitSha}`], // Legacy packages field
        templateArgs: [
          // CRITICAL FIX: Store owner/repo WITHOUT commitSha
          // Satellite will reconstruct full ref from git_commit_sha field
          { value: `git+https://github.com/${owner}/${repo}.git`, locked: true, description: 'GitHub repository reference (SHA added dynamically)', order: 0 }
        ]
      };
    case 'go':
      throw new Error('Go GitHub deployments are not yet supported. Go MCP servers are typically distributed as pre-built binaries.');
    default:
      throw new Error(`Unsupported runtime: ${runtime}`);
  }
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
          description: 'Validation error (missing package.json, invalid MCP SDK, invalid satellite_id, satellite not active, etc.)'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden (feature disabled, attempting to deploy to another team\'s satellite, etc.)'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Team not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    // Track deployment start time for duration metrics
    const deploymentStartTime = Date.now();

    // Helper function to emit deployment failed event
    const emitFailureEvent = (
      repositoryUrl: string,
      branch: string,
      step: string,
      errorMessage: string,
      errorCode?: string
    ) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userId = request.user ? (request.user as any).id : 'unknown';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userEmail = request.user ? (request.user as any).email : 'unknown';

        const eventContext: import('../../../events/types').EventContext = {
          db: server.db,
          logger: request.log,
          user: request.user ? {
            id: userId,
            email: userEmail,
            roleId: 'unknown'
          } : undefined,
          request: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: request.id
          },
          timestamp: new Date()
        };

        server.eventBus.emitWithContext(
          EVENT_NAMES.MCP_DEPLOYMENT_FAILED,
          {
            deployment: {
              repositoryUrl,
              branch,
              step
            },
            error: {
              message: errorMessage,
              code: errorCode
            },
            attemptedBy: {
              id: userId,
              email: userEmail
            },
            metadata: {
              ip: request.ip,
              duration: Date.now() - deploymentStartTime
            }
          },
          eventContext
        );
        request.log.info({ step, error: errorMessage }, 'MCP_DEPLOYMENT_FAILED event emitted');
      } catch (eventError) {
        request.log.error(eventError, 'Failed to emit MCP_DEPLOYMENT_FAILED event:');
        // Don't break the response if event emission fails
      }
    };

    // Check if deployment feature is enabled
    const deploymentEnabled = await GlobalSettings.getBoolean('deployment.enabled', false);
    if (!deploymentEnabled) {
      const { repository_url = 'unknown', branch = 'unknown' } = (request.body || {}) as DeployRequest;
      const errorMsg = 'GitHub deployment feature is not enabled. Please contact your DeployStack administrator to enable this feature in Global Settings.';
      emitFailureEvent(repository_url, branch, 'feature_disabled', errorMsg, 'FEATURE_DISABLED');
      const errorResponse: ErrorResponse = {
        success: false,
        error: errorMsg
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
      deployment_source = 'github_app',
      satellite_id,
      team_env,
      template_args
    } = request.body as DeployRequest;

    // Validate source
    if (source !== 'github') {
      const errorMsg = 'Only GitHub source is supported';
      emitFailureEvent(repository_url, branch, 'invalid_source', errorMsg, 'INVALID_SOURCE');
      const errorResponse: ErrorResponse = {
        success: false,
        error: errorMsg
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(400).type('application/json').send(jsonString);
    }

    // Convert typed arrays to flat formats for security validation and storage
    const flatTemplateArgs = template_args ? template_args.map(a => a.value) : [];
    const flatTeamEnv: Record<string, string> = {};
    if (team_env) {
      for (const item of team_env) {
        flatTeamEnv[item.name] = item.value;
      }
    }

    // Security validation: Validate user-provided configuration
    // Validate template_args if provided
    if (flatTemplateArgs.length > 0) {
      const argsValidation = validateArgs(flatTemplateArgs);
      if (!argsValidation.valid) {
        request.log.warn({
          operation: 'github_deployment_security_validation',
          teamId,
          userId,
          validationType: 'template_args',
          error: argsValidation.error,
          details: argsValidation.details
        }, 'Security validation failed for template_args');

        emitFailureEvent(repository_url, branch, 'validate_args', argsValidation.error!, 'SECURITY_VALIDATION_FAILED');
        const errorResponse: ErrorResponse = {
          success: false,
          error: argsValidation.error!,
          step: 'validate_args'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }
    }

    // Validate team_env if provided
    if (Object.keys(flatTeamEnv).length > 0) {
      const envValidation = validateEnvVars(flatTeamEnv);
      if (!envValidation.valid) {
        request.log.warn({
          operation: 'github_deployment_security_validation',
          teamId,
          userId,
          validationType: 'team_env',
          error: envValidation.error,
          details: envValidation.details
        }, 'Security validation failed for team_env');

        emitFailureEvent(repository_url, branch, 'validate_env', envValidation.error!, 'SECURITY_VALIDATION_FAILED');
        const errorResponse: ErrorResponse = {
          success: false,
          error: envValidation.error!,
          step: 'validate_env'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }
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
      const schema = getSchema();

      // ============================================
      // STEP 0: Validate Team Limits
      // ============================================
      // Fetch team with limits
      const teamData = await db
        .select({
          id: schema.teams.id,
          mcp_server_limit: schema.teams.mcp_server_limit,
          github_mcp_limit: schema.teams.github_mcp_limit
        })
        .from(schema.teams)
        .where(eq(schema.teams.id, teamId))
        .limit(1);

      if (!teamData || teamData.length === 0) {
        emitFailureEvent(repository_url, branch, 'validate_team', 'Team not found', 'TEAM_NOT_FOUND');
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team not found',
          step: 'validate_team'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const team = teamData[0];

      // Count total installations for this team
      const totalInstallations = await db
        .select()
        .from(schema.mcpServerInstallations)
        .where(eq(schema.mcpServerInstallations.team_id, teamId));

      const totalCount = totalInstallations.length;

      // Check total limit
      if (totalCount >= team.mcp_server_limit) {
        const errorMsg = `Team has reached the maximum limit of ${team.mcp_server_limit} MCP server installations. Current installations: ${totalCount}. Please remove existing installations or contact your administrator to increase the limit.`;
        emitFailureEvent(repository_url, branch, 'validate_total_limit', errorMsg, 'TOTAL_LIMIT_EXCEEDED');
        const errorResponse: ErrorResponse = {
          success: false,
          error: errorMsg,
          step: 'validate_total_limit'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Count GitHub-specific installations
      const githubInstallations = await db
        .select()
        .from(schema.mcpServerInstallations)
        .leftJoin(schema.mcpServers, eq(schema.mcpServerInstallations.server_id, schema.mcpServers.id))
        .where(
          and(
            eq(schema.mcpServerInstallations.team_id, teamId),
            eq(schema.mcpServers.source, 'github')
          )
        );

      const githubCount = githubInstallations.length;

      // Check GitHub limit
      if (githubCount >= team.github_mcp_limit) {
        const errorMsg = `Team has reached the maximum limit of ${team.github_mcp_limit} GitHub MCP server deployments. Current GitHub deployments: ${githubCount}. Please remove existing GitHub deployments or contact your administrator to increase the limit.`;
        emitFailureEvent(repository_url, branch, 'validate_github_limit', errorMsg, 'GITHUB_LIMIT_EXCEEDED');
        const errorResponse: ErrorResponse = {
          success: false,
          error: errorMsg,
          step: 'validate_github_limit'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      request.log.info({
        teamId,
        totalCount,
        totalLimit: team.mcp_server_limit,
        githubCount,
        githubLimit: team.github_mcp_limit,
        availableSlots: team.mcp_server_limit - totalCount,
        availableGithubSlots: team.github_mcp_limit - githubCount
      }, 'Team limits validated - deployment allowed');

      // ============================================
      // STEP 1-6: Validate Repository (Shared Logic)
      // ============================================
      request.log.info({ repository_url, branch, deployment_source }, 'Validating repository using shared service');

      let repoValidationResult;

      if (deployment_source === 'github_public') {
        // Public repo validation - no GitHub App needed
        repoValidationResult = await DeploymentValidationService.validatePublic({
          repository_url,
          branch
        });
      } else {
        // Authenticated validation via GitHub App
        const credentialService = new DeploymentCredentialService(db);
        repoValidationResult = await DeploymentValidationService.validate(
          {
            teamId,
            repository_url,
            branch,
            userId
          },
          credentialService
        );
      }

      if (!repoValidationResult.valid) {
        request.log.warn({
          operation: 'github_deployment_validation_failed',
          teamId,
          step: repoValidationResult.step,
          error: repoValidationResult.error
        }, 'GitHub repository validation failed');

        emitFailureEvent(repository_url, branch, repoValidationResult.step || 'validation_failed', repoValidationResult.error!, 'VALIDATION_FAILED');
        const errorResponse: ErrorResponse = {
          success: false,
          error: repoValidationResult.error!,
          step: repoValidationResult.step
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Extract validated metadata
      const { metadata } = repoValidationResult;
      const commitSha = metadata!.commit_sha;
      let packageName = metadata!.name;
      const packageVersion = metadata!.version;
      const packageDescription = metadata!.description;
      const packageLicense = metadata!.license;
      const runtime = metadata!.runtime;

      // Parse GitHub URL early (needed for fallback and server creation)
      const { owner, repo } = parseGitHubUrl(repository_url);

      // Fallback: Generate package name from repository name if not present
      // Common for Python projects with only requirements.txt (no pyproject.toml)
      if (!packageName) {
        packageName = repo; // e.g., "mcp-test-fastmcp"
        request.log.info({
          generatedPackageName: packageName,
          source: 'repository_name'
        }, 'Generated package name from repository (no pyproject.toml)');
      }

      request.log.info({
        packageName,
        version: packageVersion,
        runtime,
        mcpSdkDetected: metadata!.mcp_sdk.detected
      }, 'Repository validated successfully');

      // ============================================
      // STEP 7: Create mcpServers Entry
      // ============================================
      const serverId = `srv-github-${nanoid()}`;

      // Generate unique slug using McpSlugService (same as catalog servers)
      const serverSlug = await McpSlugService.generateSlug(
        packageName!,
        'team',
        teamId,
        db
      );

      // Get runtime-specific package manager configuration
      const pkgManagerConfig = getPackageManagerConfig(runtime, owner, repo, commitSha);

      try {
        await db.insert(schema.mcpServers).values({
        id: serverId,
        name: packageName!,
        official_name: null,
        slug: serverSlug,
        description: packageDescription || 'GitHub-deployed MCP server',
        long_description: packageDescription || '',
        version: packageVersion,
        repository_url: repository_url,
        repository_source: 'github',
        repository_id: null,
        repository_subfolder: null,
        git_branch: branch,
        git_commit_sha: commitSha,
        website_url: null,
        icon_url: null,
        language: runtime === 'node' ? 'typescript' : runtime === 'python' ? 'python' : runtime === 'go' ? 'go' : 'typescript',
        runtime: runtime,
        transport_type: 'stdio', // Hardcoded for GitHub deployments
        github_account_id: null,
        github_readme_base64: null,
        github_stars: null,
        packages: JSON.stringify([{
          transport: {
            command: pkgManagerConfig.command,
            args: pkgManagerConfig.args,
            env: {}
          }
        }]),
        remotes: null,
        resources: null,
        prompts: null,
        visibility: 'team',
        owner_team_id: teamId,
        license: packageLicense || null,
        // Template tier - locked GitHub reference (base args that can't be changed)
        template_args: JSON.stringify(pkgManagerConfig.templateArgs),
        template_env: JSON.stringify([]),
        template_headers: JSON.stringify([]),
        template_url_query_params: JSON.stringify([]),
        // Team tier schema - user-provided args/env during deployment wizard
        team_args_schema: template_args && template_args.length > 0
          ? JSON.stringify(template_args.map((arg, index) => ({
              name: arg.value,
              type: arg.type,
              description: `Team-configurable argument: ${arg.value}`,
              required: false,
              locked: false,
              default_team_locked: false,
              order: pkgManagerConfig.templateArgs.length + index // Start after template_args
            })))
          : JSON.stringify([]),
        team_env_schema: team_env && team_env.length > 0
          ? JSON.stringify(team_env.map((envItem) => ({
              name: envItem.name,
              type: envItem.type,
              description: `Team environment variable: ${envItem.name}`,
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
        deployment_source: deployment_source, // 'github_app' or 'github_public'
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
              name: packageName!,
              description: packageDescription || 'GitHub-deployed MCP server',
              language: runtime === 'node' ? 'typescript' : runtime === 'python' ? 'python' : runtime === 'go' ? 'go' : 'typescript',
              runtime: runtime
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

      // Validate satellite using shared validation service
      const satelliteValidationService = new SatelliteValidationService(db, request.log);

      const satelliteValidationResult = await satelliteValidationService.validateSatellite({
        satelliteId: satellite_id,
        teamId,
        autoSelect: true
      });

      if (!satelliteValidationResult.valid) {
        emitFailureEvent(
          repository_url,
          branch,
          'validate_satellite',
          satelliteValidationResult.error!,
          satelliteValidationResult.errorCode
        );
        const errorResponse: ErrorResponse = {
          success: false,
          error: satelliteValidationResult.error!,
          step: 'validate_satellite'
        };
        const jsonString = JSON.stringify(errorResponse);
        // Map httpStatus to allowed status codes (400, 403 are the only ones we use)
        const statusCode = satelliteValidationResult.httpStatus === 403 ? 403 : 400;
        return reply.status(statusCode).type('application/json').send(jsonString);
      }

      const satelliteId = satelliteValidationResult.satelliteId;

      const installationService = new McpInstallationService(db, request.log);
      const mcpInstallation = await installationService.createInstallation(
        teamId,
        userId,
        {
          server_id: serverId,
          installation_name: `GitHub: ${packageName}`,
          installation_type: 'team',
          satellite_id: satelliteId,
          team_args: flatTemplateArgs.length > 0 ? flatTemplateArgs : undefined,
          team_env: Object.keys(flatTeamEnv).length > 0 ? flatTeamEnv : undefined,
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
      // STEP 12: Emit Deployment Success Event
      // ============================================
      try {
        const eventContext: import('../../../events/types').EventContext = {
          db: server.db,
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
          EVENT_NAMES.MCP_DEPLOYMENT_SUCCEEDED,
          {
            deployment: {
              installationId: mcpInstallation.id,
              serverId,
              commitSha,
              repositoryUrl: repository_url,
              branch
            },
            deployedBy: {
              id: userId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email
            },
            metadata: {
              ip: request.ip,
              duration: Date.now() - deploymentStartTime
            }
          },
          eventContext
        );
        request.log.info(`MCP_DEPLOYMENT_SUCCEEDED event emitted for installation: ${mcpInstallation.id}`);
      } catch (eventError) {
        request.log.error(eventError, `Failed to emit MCP_DEPLOYMENT_SUCCEEDED event for installation ${mcpInstallation.id}:`);
        // Don't fail deployment if event emission fails
      }

      // ============================================
      // STEP 13: Return Success (Installation Created!)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorStep = (error as any).step || 'internal_error';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorCode = (error as any).code;

      const { teamId } = request.params as { teamId: string };
      const { repository_url = 'unknown', branch = 'unknown' } = (request.body || {}) as DeployRequest;

      request.log.error({
        operation: 'github_deployment_failed',
        teamId,
        error: errorMessage,
        stack: errorStack
      }, 'GitHub deployment failed');

      // Emit deployment failed event using helper
      emitFailureEvent(repository_url, branch, errorStep, errorMessage, errorCode);

      const errorResponse: ErrorResponse = {
        success: false,
        error: errorMessage || 'Internal server error during deployment',
        step: errorStep
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
