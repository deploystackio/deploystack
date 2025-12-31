import type { FastifyInstance } from 'fastify';
import { TeamService } from '../../../services/teamService';
import { UserService } from '../../../services/userService';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import {
  ADD_TEAM_MEMBER_SCHEMA,
  TEAM_MEMBER_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type AddTeamMemberInput,
  type TeamMemberResponse,
  type ErrorResponse,
  type TeamMember,
} from '../schemas';
import { EVENT_NAMES } from '../../../events';
import type { EventContext } from '../../../events/types';

// Define the params interface locally
interface TeamIdParams {
  id: string;
}

export default async function addTeamMemberRoute(server: FastifyInstance) {
  const userService = new UserService();
  
  // POST /teams/:id/members - Add team member
  server.post('/teams/:id/members', {
    preValidation: requireTeamPermission('team.members.manage', (request) => {
      const params = request.params as { id?: string };
      return params?.id || '';
    }),
    schema: {
      tags: ['Team Members'],
      summary: 'Add team member',
      description: 'Adds a new member to a team by email address. Only team admins and owners can add members. Cannot add members to default teams. Team member limit is configurable via global settings (default: 3 members maximum). Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1, description: 'Team ID' }
        },
        required: ['id'],
        additionalProperties: false
      },
      body: ADD_TEAM_MEMBER_SCHEMA,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ADD_TEAM_MEMBER_SCHEMA
          }
        }
      },
      response: {
        201: {
          ...TEAM_MEMBER_RESPONSE_SCHEMA,
          description: 'Team member added successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Validation error, team limit reached, user not found, or cannot add to default team'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Team not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      // TypeScript type assertion (Fastify has already validated)
      const { id: teamId } = request.params as TeamIdParams;
      const { email, role } = request.body as AddTeamMemberInput;

      // Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        const errorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Default teams are protected - NO ONE can add members to them (including global admins)
      if (team.is_default) {
        const errorResponse = {
          success: false,
          error: 'Cannot add members to default teams'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Find user by email address
      const targetUser = await userService.getUserByEmail(email);
      if (!targetUser) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: `User with email '${email}' not found. User must have a DeployStack account before being added to a team.`
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Add the member using the resolved user ID
      await TeamService.addTeamMember(teamId, targetUser.id, role);

      // Provision MCP server instances for new team member
      // Each team member gets their own instance of each team installation
      try {
        const { getDb } = await import('../../../db');
        const db = getDb();
        const { McpInstallationService } = await import('../../../services/mcpInstallationService');
        const { McpInstanceService } = await import('../../../services/mcpInstanceService');
        const { SatelliteCommandService } = await import('../../../services/satelliteCommandService');

        const installationService = new McpInstallationService(db, request.log);
        const instanceService = new McpInstanceService(db, request.log);
        const satelliteCommandService = new SatelliteCommandService(db, request.log);

        // Get all installations for this team
        const installations = await installationService.getTeamInstallationIds(teamId);

        request.log.info({
          operation: 'add_team_member_provision_instances',
          teamId,
          userId: targetUser.id,
          installationCount: installations.length
        }, `Provisioning ${installations.length} instances for new member`);

        // Import detection utilities
        const { hasRequiredUserConfiguration, getRequiredUserFields } = await import('../../../utils/mcpConfigDetection');
        const { mcpUserConfigurations } = await import('../../../db/schema');
        const { and, eq } = await import('drizzle-orm');

        // Create instance for each installation
        for (const installation of installations) {
          try {
            // Get installation with server details to check for required user config
            const installationWithServer = await installationService.getInstallationById(installation.id, teamId);

            if (!installationWithServer?.server) {
              request.log.warn({ installation_id: installation.id }, 'Server not found for installation');
              continue;
            }

            const server = installationWithServer.server;

            // Check if server requires user configuration
            const requiresUserConfig = hasRequiredUserConfiguration(server);

            // Check if user already has configuration
            const hasUserConfig = await db
              .select()
              .from(mcpUserConfigurations)
              .where(
                and(
                  eq(mcpUserConfigurations.installation_id, installation.id),
                  eq(mcpUserConfigurations.user_id, targetUser.id)
                )
              )
              .limit(1)
              .then(rows => rows.length > 0);

            // Determine initial status
            let initialStatus: string;
            let statusMessage: string | undefined;

            if (requiresUserConfig && !hasUserConfig) {
              initialStatus = 'awaiting_user_config';
              const requiredFields = getRequiredUserFields(server);
              statusMessage = `User configuration required. Missing fields: ${requiredFields.join(', ')}`;
            } else {
              initialStatus = 'provisioning';
              statusMessage = undefined;
            }

            // Create instance with appropriate status
            await instanceService.createInstance(
              installation.id,
              targetUser.id,
              initialStatus,
              statusMessage
            );

            // Notify satellites to spawn process (satellite will respect status)
            await satelliteCommandService.notifyMcpInstallation(
              installation.id,
              teamId,
              targetUser.id
            );

            request.log.debug({
              operation: 'add_team_member_provision_instance',
              installationId: installation.id,
              userId: targetUser.id,
              status: initialStatus
            }, 'Instance provisioned for new member');

          } catch (error) {
            request.log.error({
              operation: 'add_team_member_provision_instance',
              installationId: installation.id,
              userId: targetUser.id,
              error: error instanceof Error ? error.message : 'Unknown'
            }, 'Failed to provision instance');
            // Continue with other installations
          }
        }

      } catch (error) {
        request.log.error({
          operation: 'add_team_member_provision_instances',
          teamId,
          userId: targetUser.id,
          error: error instanceof Error ? error.message : 'Unknown'
        }, 'Failed to provision instances for new member');
        // Don't fail member addition
      }

      // Get the full member info to return
      const members = await TeamService.getTeamMembersWithUserInfo(teamId);
      const newMemberData = members.find(m => m.user_id === targetUser.id);
      
      if (!newMemberData) {
        throw new Error('Failed to retrieve newly added member');
      }
      
      // Convert TeamMemberWithUser to TeamMember (handle optional properties)
      const newMember: TeamMember = {
        id: newMemberData.id,
        user_id: newMemberData.user_id,
        username: newMemberData.username,
        email: newMemberData.email,
        first_name: newMemberData.first_name ?? null,
        last_name: newMemberData.last_name ?? null,
        role: newMemberData.role,
        is_admin: newMemberData.is_admin,
        is_owner: newMemberData.is_owner,
        joined_at: newMemberData.joined_at
      };

      // Emit TEAM_MEMBER_ADDED event
      try {
        const eventContext: EventContext = {
          db: server.db,
          logger: server.log,
          user: {
            id: request.user!.id,
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
          EVENT_NAMES.TEAM_MEMBER_ADDED,
          {
            team: {
              id: team.id,
              name: team.name
            },
            member: {
              id: targetUser.id,
              email: targetUser.email,
              name: targetUser.username || `${targetUser.first_name || ''} ${targetUser.last_name || ''}`.trim() || targetUser.email,
              role: role
            },
            addedBy: {
              id: request.user!.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email
            },
            metadata: {
              ip: request.ip
            }
          },
          eventContext
        );
        server.log.info(`TEAM_MEMBER_ADDED event emitted for team: ${team.id}, member: ${targetUser.id}`);
      } catch (eventError) {
        server.log.error(eventError, `Failed to emit TEAM_MEMBER_ADDED event for team ${team.id}:`);
        // Don't fail member addition if event emission fails
      }

      const successResponse: TeamMemberResponse = {
        success: true,
        data: newMember,
        message: `Team member '${email}' added successfully`
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(201).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof Error) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: error.message
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      server.log.error(error, 'Error adding team member');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to add team member'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
