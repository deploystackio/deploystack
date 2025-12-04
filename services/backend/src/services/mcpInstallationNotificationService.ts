import { eq } from 'drizzle-orm';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import { getSchema } from '../db';
import { JobQueueService } from './jobQueueService';

/**
 * Service for sending email notifications when MCP servers are installed or removed
 */
export class McpInstallationNotificationService {
  private readonly db: AnyDatabase;
  private readonly logger: FastifyBaseLogger;
  private readonly jobQueueService: JobQueueService;

  constructor(db: AnyDatabase, logger: FastifyBaseLogger) {
    this.db = db;
    this.logger = logger;
    this.jobQueueService = new JobQueueService(db, logger);
  }

  /**
   * Send installation created notifications to all team members
   */
  async notifyInstallationCreated(
    serverId: string,
    teamId: string
  ): Promise<void> {
    try {
      const serverInfo = await this.getServerInfo(serverId);
      const teamInfo = await this.getTeamInfo(teamId);
      const teamMembers = await this.getTeamMembers(teamId);

      if (!serverInfo || !teamInfo) {
        this.logger.warn({
          operation: 'mcp_installation_notification',
          serverId,
          teamId,
          serverFound: !!serverInfo,
          teamFound: !!teamInfo
        }, 'Cannot send notification: server or team not found');
        return;
      }

      if (teamMembers.length === 0) {
        this.logger.warn({
          operation: 'mcp_installation_notification',
          teamId
        }, 'No team members found to notify');
        return;
      }

      // Queue email for each team member
      for (const member of teamMembers) {
        await this.jobQueueService.createJob('send_email', {
          to: member.email,
          subject: `MCP Server Installed - ${serverInfo.name}`,
          template: 'mcp-installation-created',
          variables: {
            userName: member.username || member.email,
            serverName: serverInfo.name,
            serverDescription: serverInfo.description || '',
            teamName: teamInfo.name,
            dashboardUrl: 'https://cloud.deploystack.io/dashboard'
          }
        });
      }

      this.logger.info({
        operation: 'mcp_installation_notification',
        event: 'created',
        serverName: serverInfo.name,
        teamName: teamInfo.name,
        recipientCount: teamMembers.length
      }, `Queued ${teamMembers.length} installation notification emails`);

    } catch (error) {
      this.logger.error({
        operation: 'mcp_installation_notification',
        event: 'created',
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to queue installation notification emails');
    }
  }

  /**
   * Send installation deleted notifications to all team members
   */
  async notifyInstallationDeleted(
    serverName: string,
    serverDescription: string,
    teamId: string
  ): Promise<void> {
    try {
      const teamInfo = await this.getTeamInfo(teamId);
      const teamMembers = await this.getTeamMembers(teamId);

      if (!teamInfo) {
        this.logger.warn({
          operation: 'mcp_installation_notification',
          teamId
        }, 'Cannot send notification: team not found');
        return;
      }

      if (teamMembers.length === 0) {
        this.logger.warn({
          operation: 'mcp_installation_notification',
          teamId
        }, 'No team members found to notify');
        return;
      }

      // Queue email for each team member
      for (const member of teamMembers) {
        await this.jobQueueService.createJob('send_email', {
          to: member.email,
          subject: `MCP Server Removed - ${serverName}`,
          template: 'mcp-installation-deleted',
          variables: {
            userName: member.username || member.email,
            serverName: serverName,
            serverDescription: serverDescription || '',
            teamName: teamInfo.name
          }
        });
      }

      this.logger.info({
        operation: 'mcp_installation_notification',
        event: 'deleted',
        serverName: serverName,
        teamName: teamInfo.name,
        recipientCount: teamMembers.length
      }, `Queued ${teamMembers.length} removal notification emails`);

    } catch (error) {
      this.logger.error({
        operation: 'mcp_installation_notification',
        event: 'deleted',
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to queue removal notification emails');
    }
  }

  /**
   * Get server information from database
   */
  private async getServerInfo(
    serverId: string
  ): Promise<{ name: string; description: string | null } | null> {
    const schema = getSchema();
    const result = await this.db
      .select({
        name: schema.mcpServers.name,
        description: schema.mcpServers.description
      })
      .from(schema.mcpServers)
      .where(eq(schema.mcpServers.id, serverId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get team information from database
   */
  private async getTeamInfo(
    teamId: string
  ): Promise<{ name: string } | null> {
    const schema = getSchema();
    const result = await this.db
      .select({
        name: schema.teams.name
      })
      .from(schema.teams)
      .where(eq(schema.teams.id, teamId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get all team members with their email addresses
   */
  private async getTeamMembers(
    teamId: string
  ): Promise<Array<{ email: string; username: string | null }>> {
    const schema = getSchema();
    const result = await this.db
      .select({
        email: schema.authUser.email,
        username: schema.authUser.username
      })
      .from(schema.teamMemberships)
      .innerJoin(
        schema.authUser,
        eq(schema.teamMemberships.user_id, schema.authUser.id)
      )
      .where(eq(schema.teamMemberships.team_id, teamId));

    return result;
  }
}
