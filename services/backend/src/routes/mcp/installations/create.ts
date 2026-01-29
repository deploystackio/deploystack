import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { McpUserConfigurationService } from '../../../services/mcpUserConfigurationService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { McpInstallationNotificationService } from '../../../services/mcpInstallationNotificationService';
import { SatelliteValidationService } from '../../../services/satelliteValidationService';
import { getDb } from '../../../db';
import {
  TEAM_ID_PARAM_SCHEMA,
  CREATE_INSTALLATION_REQUEST_SCHEMA,
  INSTALLATION_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  formatInstallationResponse,
  type TeamIdParams,
  type CreateInstallationRequest,
  type InstallationData,
  type InstallationSuccessResponse,
  type ErrorResponse
} from './schemas';
import { EVENT_NAMES } from '../../../events';
import type { EventContext } from '../../../events/types';
import { hasRequiredUserConfiguration, getRequiredUserFields } from '../../../utils/mcpConfigDetection';
import { eq, and } from 'drizzle-orm';

export default async function createInstallationRoute(server: FastifyInstance) {
  server.post('/teams/:teamId/mcp/installations', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.installations.create')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Install MCP server for team',
      description: 'Creates a new MCP server installation for the specified team. Requires Content-Type: application/json header when sending request body.',
      security: DUAL_AUTH_SECURITY,
      
      // Fastify validation schema
      params: TEAM_ID_PARAM_SCHEMA,
      body: CREATE_INSTALLATION_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schemas, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: CREATE_INSTALLATION_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        201: {
          ...INSTALLATION_SUCCESS_RESPONSE_SCHEMA,
          description: 'Installation created successfully'
        },
        ...COMMON_ERROR_RESPONSES,
        409: {
          ...COMMON_ERROR_RESPONSES[400],
          description: 'Conflict - Installation name already exists'
        }
      }
    }
  }, async (request, reply) => {
    // TypeScript type assertion (Fastify has already validated)
    const { teamId } = request.params as TeamIdParams;
    const userId = request.user!.id;
    const installationData = request.body as CreateInstallationRequest;
    const authType = request.tokenPayload ? 'oauth2' : 'cookie';

    request.log.debug({
      operation: 'create_mcp_installation',
      teamId,
      userId,
      authType,
      clientId: request.tokenPayload?.clientId,
      scope: request.tokenPayload?.scope,
      endpoint: request.url
    }, 'Authentication method determined for MCP installation creation');

    request.log.info({
      operation: 'create_mcp_installation',
      teamId,
      userId,
      authType,
      serverId: installationData.server_id,
      installationName: installationData.installation_name
    }, 'Creating MCP server installation');

    try {
      const db = getDb();

      // Validate satellite using shared validation service
      const satelliteValidationService = new SatelliteValidationService(db, request.log);

      const validationResult = await satelliteValidationService.validateSatellite({
        satelliteId: installationData.satellite_id,
        teamId,
        autoSelect: true
      });

      if (!validationResult.valid) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: validationResult.error!
        };
        const jsonString = JSON.stringify(errorResponse);
        // Map httpStatus to allowed status codes (400, 403 are the only ones we use)
        const statusCode = validationResult.httpStatus === 403 ? 403 : 400;
        return reply.status(statusCode).type('application/json').send(jsonString);
      }

      // Use validated satellite_id
      const validatedInstallationData = {
        ...installationData,
        satellite_id: validationResult.satelliteId
      };

      const installationService = new McpInstallationService(db, request.log);

      const installation = await installationService.createInstallation(
        teamId,
        userId,
        validatedInstallationData
      ) as InstallationData;

      request.log.info({
        operation: 'create_mcp_installation',
        installationId: installation.id,
        teamId,
        serverId: installationData.server_id
      }, 'MCP server installation created successfully');

      // Check if user config data was provided and create user configuration
      const hasUserConfig =
        (installationData.user_args && Object.keys(installationData.user_args).length > 0) ||
        (installationData.user_environment_variables && Object.keys(installationData.user_environment_variables).length > 0) ||
        (installationData.user_headers && Object.keys(installationData.user_headers).length > 0) ||
        (installationData.user_url_query_params && Object.keys(installationData.user_url_query_params).length > 0);

      if (hasUserConfig) {
        try {
          const userConfigService = new McpUserConfigurationService(db, request.log);
          await userConfigService.createUserConfiguration(
            installation.id,
            userId,
            teamId,
            {
              user_args: installationData.user_args,
              user_env: installationData.user_environment_variables,
              user_headers: installationData.user_headers,
              user_url_query_params: installationData.user_url_query_params
            }
          );
          request.log.info({
            operation: 'create_mcp_installation',
            installationId: installation.id,
            userId
          }, 'User configuration created during installation');
        } catch (userConfigError) {
          // Log but don't fail - team installation succeeded
          request.log.warn({
            operation: 'create_mcp_installation',
            installationId: installation.id,
            error: userConfigError instanceof Error ? userConfigError.message : 'Unknown error'
          }, 'Failed to create user configuration during installation');
        }
      }

      // Create first instance for installing admin
      // Each user gets their own instance with independent status tracking
      try {
        const { McpInstanceService } = await import('../../../services/mcpInstanceService');
        const instanceService = new McpInstanceService(db, request.log);

        // Determine initial status based on whether server requires user config
        let adminStatus = 'provisioning';
        let adminStatusMessage: string | undefined;

        // Get server to check if it requires user config
        const serverWithConfig = await installationService.getInstallationById(installation.id, teamId);

        if (serverWithConfig?.server) {
          const requiresUserConfig = hasRequiredUserConfiguration(serverWithConfig.server);

          // If server requires user config and admin didn't provide it, set awaiting_user_config
          if (requiresUserConfig && !hasUserConfig) {
            adminStatus = 'awaiting_user_config';
            const requiredFields = getRequiredUserFields(serverWithConfig.server);
            adminStatusMessage = `User configuration required. Missing fields: ${requiredFields.join(', ')}`;
          }
        }

        await instanceService.createInstance(
          installation.id,
          userId, // Installing admin
          adminStatus,
          adminStatusMessage
        );

        request.log.info({
          operation: 'create_mcp_installation',
          installationId: installation.id,
          userId,
          instanceCreated: true,
          initialStatus: adminStatus
        }, `Created first instance for installing admin with status: ${adminStatus}`);
      } catch (error) {
        request.log.error({
          operation: 'create_mcp_installation',
          installationId: installation.id,
          error: error instanceof Error ? error.message : 'Unknown'
        }, 'Failed to create instance - installation may be orphaned');
        // Continue - instance can be created manually if needed
      }

      // Create instances for all other team members
      try {
        const { TeamService } = await import('../../../services/teamService');
        const { McpInstanceService } = await import('../../../services/mcpInstanceService');
        const { SatelliteCommandService } = await import('../../../services/satelliteCommandService');

        const instanceService = new McpInstanceService(db, request.log);
        const satelliteCommandService = new SatelliteCommandService(db, request.log);

        // Get all team members (excluding installing admin who already has instance)
        const allMembers = await TeamService.getTeamMembers(teamId);
        const otherMembers = allMembers.filter(member => member.user_id !== userId);

        request.log.info({
          operation: 'create_mcp_installation_provision_instances',
          installationId: installation.id,
          teamId,
          otherMemberCount: otherMembers.length,
          totalMembers: allMembers.length
        }, `Provisioning instances for ${otherMembers.length} other team members`);

        // Get server to check if it requires user config (do this once, outside loop)
        const serverWithConfig = await installationService.getInstallationById(installation.id, teamId);
        const requiresUserConfig = serverWithConfig?.server ? hasRequiredUserConfiguration(serverWithConfig.server) : false;

        // Create instance for each other team member
        for (const member of otherMembers) {
          try {
            // Determine initial status based on whether server requires user config
            let memberStatus = 'provisioning';
            let memberStatusMessage: string | undefined;

            if (requiresUserConfig && serverWithConfig?.server) {
              // Check if member already has user configuration (unlikely for new installation, but possible)
              const { mcpUserConfigurations } = await import('../../../db/schema');
              const hasConfig = await db
                .select()
                .from(mcpUserConfigurations)
                .where(
                  and(
                    eq(mcpUserConfigurations.installation_id, installation.id),
                    eq(mcpUserConfigurations.user_id, member.user_id)
                  )
                )
                .limit(1)
                .then(rows => rows.length > 0);

              if (!hasConfig) {
                memberStatus = 'awaiting_user_config';
                const requiredFields = getRequiredUserFields(serverWithConfig.server);
                memberStatusMessage = `User configuration required. Missing fields: ${requiredFields.join(', ')}`;
              }
            }

            await instanceService.createInstance(
              installation.id,
              member.user_id,
              memberStatus,
              memberStatusMessage
            );

            // Only notify satellite if status is NOT awaiting_user_config
            // (Backend config endpoint will filter these out anyway, but avoid unnecessary commands)
            if (memberStatus !== 'awaiting_user_config') {
              await satelliteCommandService.notifyMcpInstallation(
                installation.id,
                teamId,
                member.user_id
              );
            }

            request.log.debug({
              operation: 'create_mcp_installation_provision_instance',
              installationId: installation.id,
              userId: member.user_id,
              initialStatus: memberStatus
            }, `Instance provisioned for team member with status: ${memberStatus}`);

          } catch (error) {
            request.log.error({
              operation: 'create_mcp_installation_provision_instance',
              installationId: installation.id,
              userId: member.user_id,
              error: error instanceof Error ? error.message : 'Unknown'
            }, 'Failed to provision instance for team member');
            // Continue with other members
          }
        }

      } catch (error) {
        request.log.error({
          operation: 'create_mcp_installation_provision_instances',
          installationId: installation.id,
          teamId,
          error: error instanceof Error ? error.message : 'Unknown'
        }, 'Failed to provision instances for other team members');
        // Don't fail installation creation
      }

      // Create satellite commands for immediate notification (3-second response goal)
      try {
        const satelliteCommandService = new SatelliteCommandService(db, request.log);
        const commands = await satelliteCommandService.notifyMcpInstallation(
          installation.id,
          teamId,
          userId
        );
        
        request.log.info({
          operation: 'create_mcp_installation',
          installationId: installation.id,
          commandsCreated: commands.length,
          satelliteIds: commands.map(c => c.satellite_id)
        }, 'Satellite commands created for MCP installation');
      } catch (commandError) {
        request.log.error(commandError, `Failed to create satellite commands for installation ${installation.id}:`);
        // Don't fail installation creation if command creation fails
      }

      // Emit MCP_INSTALLATION_CREATED event
      try {
        const eventContext: EventContext = {
          db,
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
              id: installation.id,
              serverId: installation.server_id,
              teamId: teamId
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
        request.log.info(`MCP_INSTALLATION_CREATED event emitted for installation: ${installation.id}`);
      } catch (eventError) {
        request.log.error(eventError, `Failed to emit MCP_INSTALLATION_CREATED event for installation ${installation.id}:`);
        // Don't fail installation creation if event emission fails
      }

      // Queue email notifications to all team members
      try {
        const notificationService = new McpInstallationNotificationService(db, request.log);
        await notificationService.notifyInstallationCreated(
          installationData.server_id,
          teamId
        );
      } catch (notificationError) {
        request.log.error(notificationError, `Failed to queue installation notification emails for installation ${installation.id}:`);
        // Don't fail installation creation if notification fails
      }

      const response: InstallationSuccessResponse = {
        success: true,
        data: formatInstallationResponse(installation)
      };
      const jsonString = JSON.stringify(response);
      return reply.status(201).type('application/json').send(jsonString);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Check if this is a limit exceeded error (expected business logic, not an actual error)
      const isLimitExceeded = errorMessage.includes('maximum limit');

      if (isLimitExceeded) {
        request.log.warn({
          operation: 'create_mcp_installation',
          teamId,
          serverId: installationData.server_id
        }, 'MCP installation rejected: limit exceeded');
      } else {
        request.log.error({
          operation: 'create_mcp_installation',
          error,
          teamId,
          serverId: installationData.server_id
        }, 'Failed to create MCP server installation');
      }

      if (errorMessage.includes('already exists')) {
        const conflictResponse: ErrorResponse = {
          success: false,
          error: errorMessage
        };
        const jsonString = JSON.stringify(conflictResponse);
        return reply.status(409).type('application/json').send(jsonString);
      }

      if (errorMessage.includes('not found')) {
        const notFoundResponse: ErrorResponse = {
          success: false,
          error: errorMessage
        };
        const jsonString = JSON.stringify(notFoundResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const badRequestResponse: ErrorResponse = {
        success: false,
        error: errorMessage
      };
      const jsonString = JSON.stringify(badRequestResponse);
      return reply.status(400).type('application/json').send(jsonString);
    }
  });
}
