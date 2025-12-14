/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, eq, ne, or } from 'drizzle-orm';
import { getDb, getSchema } from '../../db/index';
import { McpInstallationService } from '../../services/mcpInstallationService';
import { SatelliteCommandService } from '../../services/satelliteCommandService';
import { requireAuthentication } from '../../middleware/roleMiddleware';
import { EVENT_NAMES } from '../../events';
import type { EventContext } from '../../events/types';
import {
  SUCCESS_MESSAGE_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type SuccessMessageResponse,
  type ErrorResponse
} from './schemas';

// Response schema for account deletion with owned teams
const DELETE_ACCOUNT_ERROR_WITH_TEAMS_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      default: false,
      description: 'Indicates the operation failed'
    },
    error: {
      type: 'string',
      description: 'Error message describing what went wrong'
    },
    owned_teams: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Team ID' },
          name: { type: 'string', description: 'Team name' }
        }
      },
      description: 'List of non-default teams owned by the user'
    }
  },
  required: ['success', 'error']
} as const;

interface DeleteAccountErrorWithTeams {
  success: boolean;
  error: string;
  owned_teams?: Array<{ id: string; name: string }>;
}

export default async function deleteMyAccountRoute(server: FastifyInstance) {
  server.delete('/users/me', {
    preValidation: requireAuthentication(),
    schema: {
      tags: ['Users'],
      summary: 'Delete my account',
      description: 'Permanently delete your own account. This action is irreversible and will remove all your data including your default team, MCP installations, preferences, and sessions. You cannot delete your account if you own non-default teams - you must delete those teams first. You will be removed from all teams where you are a member (but not owner).',
      security: [{ cookieAuth: [] }],

      response: {
        200: {
          ...SUCCESS_MESSAGE_RESPONSE_SCHEMA,
          description: 'Account deleted successfully'
        },
        400: {
          ...DELETE_ACCOUNT_ERROR_WITH_TEAMS_SCHEMA,
          description: 'Bad Request - Cannot delete account while owning non-default teams'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - User or default team not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request: FastifyRequest, reply) => {
    const userId = request.user!.id;
    const user = request.user as any;
    const db = getDb();
    const schema = getSchema();

    try {
      server.log.info({
        operation: 'account_deletion_start',
        userId,
        userEmail: user.email
      }, 'Starting account deletion process');

      // STEP 1: Check if user owns any non-default teams
      server.log.debug({
        operation: 'account_deletion_check_teams',
        userId
      }, 'Checking for non-default team ownership');

      const nonDefaultTeamsOwned = await db.select({
        id: schema.teams.id,
        name: schema.teams.name
      })
        .from(schema.teams)
        .where(
          and(
            eq(schema.teams.owner_id, userId),
            eq(schema.teams.is_default, false)
          )
        );

      if (nonDefaultTeamsOwned.length > 0) {
        server.log.warn({
          operation: 'account_deletion_blocked',
          userId,
          ownedTeamsCount: nonDefaultTeamsOwned.length,
          ownedTeams: nonDefaultTeamsOwned.map(t => t.name)
        }, 'Account deletion blocked - user owns non-default teams');

        const errorResponse: DeleteAccountErrorWithTeams = {
          success: false,
          error: 'Cannot delete account while owning non-default teams. Please delete all non-default teams first.',
          owned_teams: nonDefaultTeamsOwned
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // STEP 2: Remove user from all team memberships (where they're not owner)
      server.log.debug({
        operation: 'account_deletion_remove_memberships',
        userId
      }, 'Removing user from team memberships');

      const memberships = await db.select({
        membership_id: schema.teamMemberships.id,
        team_id: schema.teamMemberships.team_id,
        team_name: schema.teams.name
      })
        .from(schema.teamMemberships)
        .innerJoin(schema.teams, eq(schema.teams.id, schema.teamMemberships.team_id))
        .where(
          and(
            eq(schema.teamMemberships.user_id, userId),
            ne(schema.teams.owner_id, userId) // Not owner
          )
        );

      let removedMembershipsCount = 0;
      for (const membership of memberships) {
        try {
          await db.delete(schema.teamMemberships)
            .where(eq(schema.teamMemberships.id, membership.membership_id));

          removedMembershipsCount++;

          server.log.debug({
            operation: 'account_deletion_membership_removed',
            userId,
            teamId: membership.team_id,
            teamName: membership.team_name
          }, `Removed user from team: ${membership.team_name}`);
        } catch (membershipError) {
          server.log.error(membershipError, `Failed to remove membership from team ${membership.team_id}`);
          // Continue with other memberships even if one fails
        }
      }

      server.log.info({
        operation: 'account_deletion_memberships_removed',
        userId,
        totalMemberships: memberships.length,
        removedMemberships: removedMembershipsCount
      }, 'Team memberships removal completed');

      // STEP 3: Get user's default team
      server.log.debug({
        operation: 'account_deletion_find_default_team',
        userId
      }, 'Finding user default team');

      const defaultTeamResult = await db.select()
        .from(schema.teams)
        .where(
          and(
            eq(schema.teams.owner_id, userId),
            eq(schema.teams.is_default, true)
          )
        )
        .limit(1);

      if (defaultTeamResult.length === 0) {
        server.log.error({
          operation: 'account_deletion_no_default_team',
          userId
        }, 'Default team not found for user');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Default team not found for user'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const defaultTeam = defaultTeamResult[0];
      const teamId = defaultTeam.id;

      server.log.info({
        operation: 'account_deletion_default_team_found',
        userId,
        teamId,
        teamName: defaultTeam.name
      }, `Found default team: ${defaultTeam.name}`);

      // STEP 4: Delete all MCP installations from default team
      // Use the same pattern as deleteTeam.ts
      server.log.debug({
        operation: 'account_deletion_delete_mcp_installations',
        userId,
        teamId
      }, 'Starting MCP installations deletion');

      const installationService = new McpInstallationService(db, server.log);
      const satelliteCommandService = new SatelliteCommandService(db, server.log);

      const installations = await installationService.getTeamInstallations(teamId, userId);

      let deletedCount = 0;
      let totalCommands = 0;

      for (const installation of installations) {
        try {
          // 1. Delete installation from database
          const deleted = await installationService.deleteInstallation(installation.id, teamId);
          if (deleted) {
            deletedCount++;
          }

          // 2. Create satellite commands to kill processes (fire-and-forget)
          try {
            const commands = await satelliteCommandService.notifyMcpDeletion(
              installation.id,
              teamId,
              userId
            );
            totalCommands += commands.length;
          } catch (commandError) {
            server.log.error(commandError, `Failed to create satellite commands for installation ${installation.id}`);
            // Continue even if satellite command creation fails
          }
        } catch (installationError) {
          server.log.error(installationError, `Failed to delete installation ${installation.id}`);
          // Continue with other installations even if one fails
        }
      }

      server.log.info({
        operation: 'account_deletion_mcp_cleanup',
        userId,
        teamId,
        totalInstallations: installations.length,
        installationsDeleted: deletedCount,
        satelliteCommandsCreated: totalCommands
      }, 'MCP installations deleted and satellite commands created');

      // STEP 5: Queue account deletion email BEFORE deleting the user
      server.log.debug({
        operation: 'account_deletion_queue_email',
        userId,
        userEmail: user.email
      }, 'Queueing account deletion email');

      try {
        const jobQueueService = (server as any).jobQueueService;
        if (jobQueueService) {
          await jobQueueService.createJob('send_email', {
            to: user.email,
            subject: 'Your DeployStack Account Has Been Deleted',
            template: 'account-deleted',
            variables: {
              userName: user.username || user.email,
              userEmail: user.email,
              deletionDate: new Date().toISOString(),
              supportEmail: 'support@deploystack.io'
            }
          });

          server.log.info({
            operation: 'account_deletion_email_queued',
            userId,
            userEmail: user.email
          }, 'Account deletion email queued');
        } else {
          server.log.warn({
            operation: 'account_deletion_no_job_queue',
            userId
          }, 'Job queue service not available - email will not be sent');
        }
      } catch (emailError) {
        server.log.error(emailError, 'Failed to queue account deletion email - continuing with deletion');
        // Don't fail account deletion if email queueing fails
      }

      // STEP 6: Emit USER_DELETED event BEFORE actual deletion
      server.log.debug({
        operation: 'account_deletion_emit_event',
        userId,
        userEmail: user.email
      }, 'Emitting USER_DELETED event');

      try {
        if (server.eventBus) {
          const eventContext: EventContext = {
            db: db,
            logger: server.log,
            user: {
              id: userId,
              email: user.email,
              roleId: user.role_id || 'user'
            },
            request: {
              ip: request.ip,
              userAgent: request.headers['user-agent'],
              requestId: request.id
            },
            timestamp: new Date()
          };

          server.eventBus.emitWithContext(
            EVENT_NAMES.USER_DELETED,
            {
              user: {
                id: userId,
                email: user.email,
                name: user.username || user.email,
                roleId: user.role_id || 'user'
              },
              deletedBy: {
                id: userId,
                email: user.email
              },
              metadata: {
                ip: request.ip
              }
            },
            eventContext
          );

          server.log.info({
            operation: 'account_deletion_event_emitted',
            userId,
            userEmail: user.email
          }, 'USER_DELETED event emitted for self-deletion');
        }
      } catch (eventError) {
        server.log.error(eventError, 'Failed to emit USER_DELETED event - continuing with deletion');
        // Don't fail account deletion if event emission fails
      }

      // STEP 6.5: Invalidate satellite token caches
      server.log.debug({
        operation: 'account_deletion_invalidate_satellite_cache',
        userId,
        userEmail: user.email
      }, 'Sending cache invalidation commands to satellites');

      try {
        const satelliteCommandService = new SatelliteCommandService(db, server.log);
        const commands = await satelliteCommandService.notifyUserDeletion(userId, user.email);

        server.log.info({
          operation: 'account_deletion_cache_invalidation_sent',
          userId,
          userEmail: user.email,
          satelliteCommandsCreated: commands.length
        }, `Cache invalidation sent to ${commands.length} satellites`);
      } catch (cacheError) {
        server.log.error(cacheError, 'Failed to send cache invalidation - continuing deletion');
        // Non-fatal: caches expire naturally within 5 minutes
      }

      // STEP 7: Handle satellite commands - preserve pending commands
      server.log.debug({
        operation: 'account_deletion_handle_satellite_commands',
        userId,
        teamId
      }, 'Handling satellite commands');

      // Set target_team_id = NULL for PENDING commands for this team (allows team deletion without blocking satellite execution)
      await db
        .update(schema.satelliteCommands)
        .set({ target_team_id: null })
        .where(
          and(
            eq(schema.satelliteCommands.target_team_id, teamId),
            eq(schema.satelliteCommands.status, 'pending')
          )
        );

      // Delete non-pending satellite commands for this team (completed/failed/executing) since they're no longer needed
      await db
        .delete(schema.satelliteCommands)
        .where(
          and(
            eq(schema.satelliteCommands.target_team_id, teamId),
            or(
              eq(schema.satelliteCommands.status, 'completed'),
              eq(schema.satelliteCommands.status, 'failed'),
              eq(schema.satelliteCommands.status, 'acknowledged'),
              eq(schema.satelliteCommands.status, 'executing')
            )
          )
        );

      // Handle ALL commands created by this user (for any team) - set created_by = NULL for pending, delete completed
      await db
        .update(schema.satelliteCommands)
        .set({ created_by: null })
        .where(
          and(
            eq(schema.satelliteCommands.created_by, userId),
            eq(schema.satelliteCommands.status, 'pending')
          )
        );

      await db
        .delete(schema.satelliteCommands)
        .where(
          and(
            eq(schema.satelliteCommands.created_by, userId),
            or(
              eq(schema.satelliteCommands.status, 'completed'),
              eq(schema.satelliteCommands.status, 'failed'),
              eq(schema.satelliteCommands.status, 'acknowledged'),
              eq(schema.satelliteCommands.status, 'executing')
            )
          )
        );

      server.log.info({
        operation: 'account_deletion_satellite_commands_handled',
        userId,
        teamId
      }, 'Satellite commands handled - pending commands preserved');

      // STEP 7.5: Delete satellite-related records
      server.log.debug({
        operation: 'account_deletion_delete_satellite_data',
        userId,
        teamId
      }, 'Deleting satellite-related data');

      // Delete satellite processes for user's default team
      await db.delete(schema.satelliteProcesses)
        .where(eq(schema.satelliteProcesses.team_id, teamId));

      // Delete satellite usage logs for user's default team
      await db.delete(schema.satelliteUsageLogs)
        .where(eq(schema.satelliteUsageLogs.team_id, teamId));

      // Delete MCP client activity records for the user
      await db.delete(schema.mcpClientActivity)
        .where(eq(schema.mcpClientActivity.user_id, userId));

      // Delete MCP client activity metrics for the user
      await db.delete(schema.mcpClientActivityMetrics)
        .where(eq(schema.mcpClientActivityMetrics.user_id, userId));

      server.log.info({
        operation: 'account_deletion_satellite_data_deleted',
        userId,
        teamId
      }, 'Satellite-related data deleted');

      // STEP 8: Delete the default team
      server.log.debug({
        operation: 'account_deletion_delete_team',
        userId,
        teamId
      }, 'Deleting default team');

      await db.delete(schema.teams)
        .where(eq(schema.teams.id, teamId));

      // STEP 9: Delete user sessions
      server.log.debug({
        operation: 'account_deletion_delete_sessions',
        userId
      }, 'Deleting user sessions');

      await db.delete(schema.authSession)
        .where(eq(schema.authSession.userId, userId));

      // STEP 10: Delete the user account
      server.log.debug({
        operation: 'account_deletion_delete_user',
        userId
      }, 'Deleting user account');

      await db.delete(schema.authUser)
        .where(eq(schema.authUser.id, userId));

      server.log.info({
        operation: 'account_deletion_completed',
        userId,
        teamId,
        userEmail: user.email,
        membershipsRemoved: removedMembershipsCount,
        mcpInstallationsDeleted: deletedCount
      }, 'Account deletion completed successfully');

      // STEP 11: Return success response
      const successResponse: SuccessMessageResponse = {
        success: true,
        message: 'Your account has been successfully deleted. A confirmation email has been sent to your email address.'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      server.log.error(error, 'Error deleting account');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to delete account'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
