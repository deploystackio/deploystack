import type { FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { GlobalSettings } from '../../../global-settings/helpers';
import { DeploymentCredentialService } from '../../../services/deploymentCredentialService';
import { DeploymentValidationService } from '../../../services/deploymentValidationService';

// Request schema
const VALIDATE_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    repository_url: {
      type: 'string',
      minLength: 1,
      description: 'GitHub repository URL (e.g., https://github.com/user/repo)'
    },
    branch: {
      type: 'string',
      minLength: 1,
      description: 'Git branch to validate (e.g., main)'
    },
    deployment_source: {
      type: 'string',
      enum: ['github_app', 'github_public'],
      default: 'github_app',
      description: 'Deployment source: github_app (authenticated via GitHub App) or github_public (public repo, no auth)'
    }
  },
  required: ['repository_url', 'branch'],
  additionalProperties: false
} as const;

// Success response schema
const VALIDATE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    valid: { type: 'boolean' },
    metadata: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        version: { type: 'string' },
        description: { type: 'string' },
        runtime: {
          type: 'string',
          enum: ['node', 'python', 'go', 'unknown']
        },
        mcp_sdk: {
          type: 'object',
          properties: {
            detected: { type: 'boolean' },
            version: { type: 'string' },
            package: { type: 'string' },
            runtime: {
              type: 'string',
              enum: ['node', 'python', 'go', 'unknown']
            }
          },
          required: ['detected', 'runtime']
        },
        scripts: {
          type: 'object',
          additionalProperties: { type: 'string' }
        },
        commit_sha: { type: 'string' },
        warnings: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['runtime', 'mcp_sdk', 'commit_sha']
    }
  },
  required: ['valid', 'metadata']
} as const;

// Error response schema
const VALIDATE_ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    valid: { type: 'boolean' },
    error: { type: 'string' },
    step: { type: 'string' }
  },
  required: ['valid', 'error']
} as const;

interface ValidateRequest {
  repository_url: string;
  branch: string;
  deployment_source?: 'github_app' | 'github_public';
}

interface ErrorResponse {
  valid: false;
  error: string;
  step?: string;
}

export default async function validateRoute(server: FastifyInstance) {
  server.post('/teams/:teamId/deploy/validate', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.servers.deploy')
    ],
    schema: {
      tags: ['Deployment'],
      summary: 'Validate GitHub repository for deployment',
      description: 'Validates GitHub repository without creating any database entries. Returns repository metadata including runtime, MCP SDK, and build scripts. This is a lightweight validation endpoint used before the actual deployment.',
      security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1 }
        },
        required: ['teamId'],
        additionalProperties: false
      },
      body: VALIDATE_REQUEST_SCHEMA,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: VALIDATE_REQUEST_SCHEMA
          }
        }
      },
      response: {
        200: {
          ...VALIDATE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Repository validated successfully'
        },
        400: {
          ...VALIDATE_ERROR_RESPONSE_SCHEMA,
          description: 'Validation error (missing package.json, invalid MCP SDK, etc.)'
        },
        401: {
          ...VALIDATE_ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...VALIDATE_ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden'
        },
        404: {
          ...VALIDATE_ERROR_RESPONSE_SCHEMA,
          description: 'Team not found'
        },
        500: {
          ...VALIDATE_ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    // Check if deployment feature is enabled
    const deploymentEnabled = await GlobalSettings.getBoolean('deployment.enabled', false);
    if (!deploymentEnabled) {
      const errorResponse: ErrorResponse = {
        valid: false,
        error: 'GitHub deployment feature is not enabled. Please contact your DeployStack administrator to enable this feature in Global Settings.'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(403).type('application/json').send(jsonString);
    }

    const { teamId } = request.params as { teamId: string };
    const userId = request.user!.id;
    const { repository_url, branch, deployment_source = 'github_app' } = request.body as ValidateRequest;

    request.log.info({
      operation: 'github_validation_start',
      teamId,
      userId,
      repositoryUrl: repository_url,
      branch,
      deployment_source
    }, 'Starting GitHub repository validation');

    try {
      let result;

      if (deployment_source === 'github_public') {
        // Public repo validation - no GitHub App needed
        result = await DeploymentValidationService.validatePublic({
          repository_url,
          branch
        });
      } else {
        // Authenticated validation via GitHub App
        const db = getDb();
        const credentialService = new DeploymentCredentialService(db);
        result = await DeploymentValidationService.validate(
          {
            teamId,
            repository_url,
            branch,
            userId
          },
          credentialService
        );
      }

      if (!result.valid) {
        request.log.warn({
          operation: 'github_validation_failed',
          teamId,
          step: result.step,
          error: result.error
        }, 'GitHub repository validation failed');

        const errorResponse: ErrorResponse = {
          valid: false,
          error: result.error!,
          step: result.step
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'github_validation_success',
        teamId,
        runtime: result.metadata!.runtime,
        mcpSdkDetected: result.metadata!.mcp_sdk.detected
      }, 'GitHub repository validated successfully');

      const jsonString = JSON.stringify(result);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      request.log.error({
        operation: 'github_validation_error',
        teamId,
        error: errorMessage,
        stack: errorStack
      }, 'GitHub validation failed with internal error');

      const errorResponse: ErrorResponse = {
        valid: false,
        error: errorMessage || 'Internal server error during validation',
        step: 'internal_error'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
