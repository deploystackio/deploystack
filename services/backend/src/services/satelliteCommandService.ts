import { eq, and } from 'drizzle-orm';
import { satellites, satelliteCommands } from '../db/schema';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import { nanoid } from 'nanoid';

// Match schema enum from satelliteCommands table
export type CommandType = 'spawn' | 'kill' | 'restart' | 'configure' | 'health_check' | 'invalidate_user_token_cache';
export type CommandPriority = 'immediate' | 'high' | 'normal' | 'low';

export interface SatelliteCommand {
  id: string;
  satellite_id: string;
  command_type: CommandType;
  priority: CommandPriority;
  payload: string;
  target_team_id?: string;
  correlation_id?: string;
  expires_at: Date;
  created_by?: string;
}

export interface CreateCommandOptions {
  commandType: CommandType;
  priority: CommandPriority;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
  targetTeamId?: string;
  correlationId?: string;
  expiresInMinutes?: number;
  createdBy?: string;
}

export class SatelliteCommandService {
  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger
  ) {}

  /**
   * Creates commands for all active global satellites
   * Used when MCP installations/updates need to be propagated to all global satellites
   */
  async createCommandForAllGlobalSatellites(options: CreateCommandOptions): Promise<SatelliteCommand[]> {
    this.logger.debug({
      operation: 'create_command_for_all_global_satellites',
      commandType: options.commandType,
      priority: options.priority
    }, 'Creating commands for all global satellites');

    // Get all active global satellites
    const globalSatellites = await this.db
      .select()
      .from(satellites)
      .where(
        and(
          eq(satellites.satellite_type, 'global'),
          eq(satellites.status, 'active')
        )
      );

    if (globalSatellites.length === 0) {
      this.logger.warn('No active global satellites found');
      return [];
    }

    const commands: SatelliteCommand[] = [];
    const correlationId = options.correlationId || nanoid();
    const expiresAt = new Date(Date.now() + (options.expiresInMinutes || 5) * 60 * 1000);

    // Create command for each global satellite
    for (const satellite of globalSatellites) {
      const command: SatelliteCommand = {
        id: nanoid(),
        satellite_id: satellite.id,
        command_type: options.commandType,
        priority: options.priority,
        payload: JSON.stringify(options.payload),
        target_team_id: options.targetTeamId,
        correlation_id: correlationId,
        expires_at: expiresAt,
        created_by: options.createdBy
      };

      commands.push(command);
    }

    // Insert all commands in a single transaction
    await this.db.insert(satelliteCommands).values(commands.map(cmd => ({
      id: cmd.id,
      satellite_id: cmd.satellite_id,
      command_type: cmd.command_type as 'spawn' | 'kill' | 'restart' | 'configure' | 'health_check' | 'invalidate_user_token_cache',
      priority: cmd.priority as 'immediate' | 'high' | 'normal' | 'low',
      payload: cmd.payload,
      status: 'pending' as const,
      target_team_id: cmd.target_team_id,
      correlation_id: cmd.correlation_id,
      retry_count: 0,
      max_retries: 3,
      error_message: null,
      result: null,
      created_by: cmd.created_by,
      created_at: new Date(),
      updated_at: new Date()
    })));

    this.logger.info({
      operation: 'create_command_for_all_global_satellites',
      commandsCreated: commands.length,
      satelliteIds: commands.map(c => c.satellite_id),
      correlationId,
      commandType: options.commandType,
      priority: options.priority
    }, 'Successfully created commands for all global satellites');

    return commands;
  }

  /**
   * Creates a command for a specific satellite
   */
  async createCommandForSpecificSatellite(satelliteId: string, options: CreateCommandOptions): Promise<SatelliteCommand> {
    this.logger.debug({
      operation: 'create_command_for_specific_satellite',
      satelliteId,
      commandType: options.commandType,
      priority: options.priority
    }, 'Creating command for specific satellite');

    // Verify satellite exists and is active
    const satellite = await this.db
      .select()
      .from(satellites)
      .where(
        and(
          eq(satellites.id, satelliteId),
          eq(satellites.status, 'active')
        )
      )
      .limit(1);

    if (satellite.length === 0) {
      throw new Error(`Active satellite with ID ${satelliteId} not found`);
    }

    const command: SatelliteCommand = {
      id: nanoid(),
      satellite_id: satelliteId,
      command_type: options.commandType,
      priority: options.priority,
      payload: JSON.stringify(options.payload),
      target_team_id: options.targetTeamId,
      correlation_id: options.correlationId || nanoid(),
      expires_at: new Date(Date.now() + (options.expiresInMinutes || 5) * 60 * 1000),
      created_by: options.createdBy
    };

    await this.db.insert(satelliteCommands).values({
      id: command.id,
      satellite_id: command.satellite_id,
      command_type: command.command_type as 'spawn' | 'kill' | 'restart' | 'configure' | 'health_check' | 'invalidate_user_token_cache',
      priority: command.priority as 'immediate' | 'high' | 'normal' | 'low',
      payload: command.payload,
      status: 'pending' as const,
      target_team_id: command.target_team_id,
      correlation_id: command.correlation_id,
      retry_count: 0,
      max_retries: 3,
      error_message: null,
      result: null,
      created_by: command.created_by,
      created_at: new Date(),
      updated_at: new Date()
    });

    this.logger.info({
      operation: 'create_command_for_specific_satellite',
      commandId: command.id,
      satelliteId,
      commandType: options.commandType,
      priority: options.priority
    }, 'Successfully created command for specific satellite');

    return command;
  }

  /**
   * Creates commands for all satellites belonging to a specific team
   */
  async createCommandForTeamSatellites(teamId: string, options: CreateCommandOptions): Promise<SatelliteCommand[]> {
    this.logger.debug({
      operation: 'create_command_for_team_satellites',
      teamId,
      commandType: options.commandType,
      priority: options.priority
    }, 'Creating commands for team satellites');

    // Get all active satellites for the team
    const teamSatellites = await this.db
      .select()
      .from(satellites)
      .where(
        and(
          eq(satellites.team_id, teamId),
          eq(satellites.status, 'active')
        )
      );

    if (teamSatellites.length === 0) {
      this.logger.warn({ teamId }, 'No active satellites found for team');
      return [];
    }

    const commands: SatelliteCommand[] = [];
    const correlationId = options.correlationId || nanoid();
    const expiresAt = new Date(Date.now() + (options.expiresInMinutes || 5) * 60 * 1000);

    // Create command for each team satellite
    for (const satellite of teamSatellites) {
      const command: SatelliteCommand = {
        id: nanoid(),
        satellite_id: satellite.id,
        command_type: options.commandType,
        priority: options.priority,
        payload: JSON.stringify(options.payload),
        target_team_id: teamId,
        correlation_id: correlationId,
        expires_at: expiresAt,
        created_by: options.createdBy
      };

      commands.push(command);
    }

    // Insert all commands
    await this.db.insert(satelliteCommands).values(commands.map(cmd => ({
      id: cmd.id,
      satellite_id: cmd.satellite_id,
      command_type: cmd.command_type as 'spawn' | 'kill' | 'restart' | 'configure' | 'health_check' | 'invalidate_user_token_cache',
      priority: cmd.priority as 'immediate' | 'high' | 'normal' | 'low',
      payload: cmd.payload,
      status: 'pending' as const,
      target_team_id: cmd.target_team_id,
      correlation_id: cmd.correlation_id,
      retry_count: 0,
      max_retries: 3,
      error_message: null,
      result: null,
      created_by: cmd.created_by,
      created_at: new Date(),
      updated_at: new Date()
    })));

    this.logger.info({
      operation: 'create_command_for_team_satellites',
      commandsCreated: commands.length,
      teamId,
      satelliteIds: commands.map(c => c.satellite_id),
      correlationId,
      commandType: options.commandType,
      priority: options.priority
    }, 'Successfully created commands for team satellites');

    return commands;
  }

  /**
   * Convenience method for MCP installation events
   * Creates immediate priority configure commands for all global satellites
   */
  async notifyMcpInstallation(installationId: string, teamId: string, userId?: string): Promise<SatelliteCommand[]> {
    return await this.createCommandForAllGlobalSatellites({
      commandType: 'configure',
      priority: 'immediate',
      payload: {
        event: 'mcp_installation_created',
        installation_id: installationId,
        team_id: teamId
      },
      targetTeamId: teamId,
      expiresInMinutes: 5,
      createdBy: userId
    });
  }

  /**
   * Convenience method for MCP update events
   * Creates immediate priority configure commands for all global satellites
   */
  async notifyMcpUpdate(installationId: string, teamId: string, userId?: string): Promise<SatelliteCommand[]> {
    return await this.createCommandForAllGlobalSatellites({
      commandType: 'configure',
      priority: 'immediate',
      payload: {
        event: 'mcp_installation_updated',
        installation_id: installationId,
        team_id: teamId
      },
      targetTeamId: teamId,
      expiresInMinutes: 5,
      createdBy: userId
    });
  }

  /**
   * Phase 13: Notify satellites that an MCP server has recovered and needs tool rediscovery
   * Creates high priority configure commands for all global satellites
   */
  async notifyMcpRecovery(installationId: string, teamId: string): Promise<SatelliteCommand[]> {
    this.logger.info({
      operation: 'notify_mcp_recovery',
      installationId,
      teamId
    }, `Notifying satellites of MCP server recovery for installation ${installationId}`);

    return await this.createCommandForAllGlobalSatellites({
      commandType: 'configure',
      priority: 'high',
      payload: {
        event: 'mcp_recovery',
        installation_id: installationId,
        team_id: teamId
      },
      targetTeamId: teamId,
      expiresInMinutes: 5
    });
  }

  /**
   * Convenience method for MCP deletion events
   * Creates immediate priority configure commands for all global satellites
   */
  async notifyMcpDeletion(installationId: string, teamId: string, userId?: string): Promise<SatelliteCommand[]> {
    return await this.createCommandForAllGlobalSatellites({
      commandType: 'configure',
      priority: 'immediate',
      payload: {
        event: 'mcp_installation_deleted',
        installation_id: installationId,
        team_id: teamId
      },
      targetTeamId: teamId,
      expiresInMinutes: 5,
      createdBy: userId
    });
  }

  /**
   * Notify satellites to invalidate all cached tokens for a SPECIFIC deleted user
   * This ensures only the deleted user's tokens are removed from cache
   */
  async notifyUserDeletion(userId: string, userEmail: string): Promise<SatelliteCommand[]> {
    this.logger.info({
      operation: 'notify_user_deletion',
      userId,
      userEmail
    }, `Notifying satellites to invalidate tokens for deleted user: ${userEmail}`);

    return await this.createCommandForAllGlobalSatellites({
      commandType: 'invalidate_user_token_cache',
      priority: 'immediate',
      payload: {
        event: 'user_deleted',
        user_id: userId,
        user_email: userEmail
      },
      expiresInMinutes: 5
    });
  }

}
