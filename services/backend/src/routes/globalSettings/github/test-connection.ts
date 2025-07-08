import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { GitHubService } from '../../../services/githubService';
import { GlobalSettings } from '../../../global-settings';
import { z } from 'zod';

// Response schema for GitHub App test
const githubAppTestResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  message: z.string().describe('Success message'),
  details: z.object({
    repository: z.object({
      name: z.string().describe('Repository name'),
      description: z.string().describe('Repository description'),
      language: z.string().describe('Primary programming language'),
      homepage: z.string().describe('Repository homepage URL'),
      license: z.string().describe('Repository license'),
      defaultBranch: z.string().describe('Default branch name'),
      stars: z.number().describe('Number of stars'),
      forks: z.number().describe('Number of forks'),
      topics: z.array(z.string()).describe('Repository topics/tags')
    }).describe('Repository information from GitHub'),
    test_url: z.string().describe('URL of the test repository')
  }).describe('GitHub App connection test details')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.object({
    message: z.string().describe('Detailed error message')
  }).optional().describe('Additional error details')
});

export default async function githubTestConnectionRoute(fastify: FastifyInstance) {
  // POST /settings/github-app/test-connection - Test GitHub App connection (global admin only)
  fastify.post('/settings/github-app/test-connection', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Test GitHub App connection (Global Admin only)',
      description: 'Tests GitHub App configuration by fetching Microsoft VS Code repository information. Only global administrators can access this endpoint.',
      security: [{ cookieAuth: [] }],
      body: {
        type: 'object',
        properties: {},
        additionalProperties: true
      },
      response: {
        200: zodToJsonSchema(githubAppTestResponseSchema.describe('GitHub App connection test successful'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Connection test failed'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions or GitHub App disabled'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preValidation: requireGlobalAdmin(),
  }, async (request, reply) => {
    fastify.log.info({
      operation: 'github_app_test_connection',
      endpoint: '/settings/github-app/test-connection',
      method: 'POST',
      userId: request.user?.id,
      requestId: (request as any).id
    }, '🚀 GitHub App connection test endpoint reached');

    fastify.log.debug({
      operation: 'github_app_test_connection',
      endpoint: '/settings/github-app/test-connection',
      method: 'POST'
    }, '🔄 Starting GitHub App connection test');

    try {
      // Check if GitHub App is enabled
      fastify.log.debug({
        operation: 'github_app_test_connection',
        step: 'check_enabled'
      }, '🔍 Checking if GitHub App integration is enabled');

      const enabled = await GlobalSettings.getBoolean('github.app.enabled', false);
      
      fastify.log.debug({
        operation: 'github_app_test_connection',
        step: 'check_enabled',
        enabled
      }, `📋 GitHub App integration enabled: ${enabled}`);

      if (!enabled) {
        fastify.log.warn({
          operation: 'github_app_test_connection',
          step: 'check_enabled',
          enabled: false
        }, '⚠️ GitHub App integration is disabled');

        return reply.status(403).send({
          success: false,
          error: 'GitHub App integration is disabled. Please enable it first.',
        });
      }

      // Check all required GitHub App settings
      fastify.log.debug({
        operation: 'github_app_test_connection',
        step: 'check_settings'
      }, '🔍 Checking GitHub App configuration settings');

      let appId: string;
      let privateKeyBase64: string;
      let installationId: string;

      try {
        fastify.log.debug({
          operation: 'github_app_test_connection',
          step: 'get_app_id'
        }, '📋 Retrieving GitHub App ID');
        
        appId = await GlobalSettings.getRequired('github.app.app_id');
        
        fastify.log.debug({
          operation: 'github_app_test_connection',
          step: 'get_app_id',
          appId: appId ? `${appId.substring(0, 4)}...` : 'null',
          hasValue: !!appId
        }, `📋 GitHub App ID retrieved: ${appId ? 'present' : 'missing'}`);
      } catch (error) {
        fastify.log.error({
          operation: 'github_app_test_connection',
          step: 'get_app_id',
          error
        }, '❌ Failed to retrieve GitHub App ID');
        throw new Error(`GitHub App ID is required but not configured: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      try {
        fastify.log.debug({
          operation: 'github_app_test_connection',
          step: 'get_private_key'
        }, '📋 Retrieving GitHub App private key');
        
        privateKeyBase64 = await GlobalSettings.getRequired('github.app.private_key_base64');
        
        fastify.log.debug({
          operation: 'github_app_test_connection',
          step: 'get_private_key',
          hasValue: !!privateKeyBase64,
          keyLength: privateKeyBase64 ? privateKeyBase64.length : 0
        }, `📋 GitHub App private key retrieved: ${privateKeyBase64 ? 'present' : 'missing'} (${privateKeyBase64 ? privateKeyBase64.length : 0} chars)`);
      } catch (error) {
        fastify.log.error({
          operation: 'github_app_test_connection',
          step: 'get_private_key',
          error
        }, '❌ Failed to retrieve GitHub App private key');
        throw new Error(`GitHub App private key is required but not configured: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      try {
        fastify.log.debug({
          operation: 'github_app_test_connection',
          step: 'get_installation_id'
        }, '📋 Retrieving GitHub App installation ID');
        
        installationId = await GlobalSettings.getRequired('github.app.installation_id');
        
        fastify.log.debug({
          operation: 'github_app_test_connection',
          step: 'get_installation_id',
          installationId: installationId ? `${installationId.substring(0, 4)}...` : 'null',
          hasValue: !!installationId
        }, `📋 GitHub App installation ID retrieved: ${installationId ? 'present' : 'missing'}`);
      } catch (error) {
        fastify.log.error({
          operation: 'github_app_test_connection',
          step: 'get_installation_id',
          error
        }, '❌ Failed to retrieve GitHub App installation ID');
        throw new Error(`GitHub App installation ID is required but not configured: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      fastify.log.info({
        operation: 'github_app_test_connection',
        step: 'settings_validated',
        hasAppId: !!appId,
        hasPrivateKey: !!privateKeyBase64,
        hasInstallationId: !!installationId
      }, '✅ All GitHub App settings are configured');

      // Clear any cached authentication to ensure we test with current settings
      fastify.log.debug({
        operation: 'github_app_test_connection',
        step: 'clear_auth_cache'
      }, '🧹 Clearing GitHub authentication cache to ensure fresh credentials are used');
      
      GitHubService.clearAuthCache();

      // Test connection with Microsoft VS Code repository
      const testRepoUrl = 'https://github.com/microsoft/vscode';
      
      fastify.log.info({
        operation: 'github_app_test_connection',
        test_url: testRepoUrl,
        step: 'start_test'
      }, '🚀 Testing GitHub App connection');

      fastify.log.debug({
        operation: 'github_app_test_connection',
        step: 'call_github_service',
        test_url: testRepoUrl
      }, '📞 Calling GitHubService.getRepositoryInfo');

      const startTime = Date.now();
      const repoInfo = await GitHubService.getRepositoryInfo(testRepoUrl, request.log);
      const duration = Date.now() - startTime;
      
      fastify.log.info({
        operation: 'github_app_test_connection',
        success: true,
        repository_name: repoInfo.name,
        stars: repoInfo.stars,
        duration_ms: duration,
        step: 'success'
      }, `✅ GitHub App connection test successful (${duration}ms)`);

      return reply.status(200).send({
        success: true,
        message: 'GitHub App connection successful',
        details: {
          repository: repoInfo,
          test_url: testRepoUrl
        }
      });
    } catch (error) {
      fastify.log.error({
        operation: 'github_app_test_connection',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : 'UnknownError'
        },
        test_url: 'https://github.com/microsoft/vscode'
      }, '❌ GitHub App connection test failed');

      // Handle specific error types with more detailed logging
      if (error instanceof Error) {
        fastify.log.debug({
          operation: 'github_app_test_connection',
          step: 'error_analysis',
          errorMessage: error.message,
          errorName: error.name
        }, '🔍 Analyzing error type');

        if (error.message.includes('GitHub App integration is not enabled')) {
          fastify.log.warn({
            operation: 'github_app_test_connection',
            step: 'error_handling',
            errorType: 'integration_disabled'
          }, '⚠️ Returning 403: GitHub App integration disabled');
          
          return reply.status(403).send({
            success: false,
            error: 'GitHub App integration is not enabled',
          });
        }
        
        if (error.message.includes('Setting not found') || error.message.includes('required') || error.message.includes('not configured')) {
          fastify.log.warn({
            operation: 'github_app_test_connection',
            step: 'error_handling',
            errorType: 'configuration_incomplete',
            errorMessage: error.message
          }, '⚠️ Returning 400: GitHub App configuration incomplete');
          
          return reply.status(400).send({
            success: false,
            error: 'GitHub App configuration is incomplete. Please configure all required settings (App ID, Private Key, Installation ID).',
            details: {
              message: error.message
            }
          });
        }
        
        if (error.message.includes('authentication') || error.message.includes('credentials') || error.message.includes('401') || error.message.includes('403')) {
          fastify.log.warn({
            operation: 'github_app_test_connection',
            step: 'error_handling',
            errorType: 'authentication_failed',
            errorMessage: error.message
          }, '⚠️ Returning 400: GitHub App authentication failed');
          
          return reply.status(400).send({
            success: false,
            error: 'GitHub App authentication failed. Please check your credentials.',
            details: {
              message: error.message
            }
          });
        }

        if (error.message.includes('Invalid GitHub URL')) {
          fastify.log.warn({
            operation: 'github_app_test_connection',
            step: 'error_handling',
            errorType: 'invalid_url',
            errorMessage: error.message
          }, '⚠️ Returning 400: Invalid test repository URL');
          
          return reply.status(400).send({
            success: false,
            error: 'Invalid test repository URL',
            details: {
              message: error.message
            }
          });
        }
      }

      fastify.log.warn({
        operation: 'github_app_test_connection',
        step: 'error_handling',
        errorType: 'generic_failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }, '⚠️ Returning 400: Generic connection test failure');

      return reply.status(400).send({
        success: false,
        message: 'Connection failed',
        timestamp: new Date().toISOString(),
        details: {
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });
}
