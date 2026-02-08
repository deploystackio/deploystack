/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and, inArray } from 'drizzle-orm';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import { nanoid } from 'nanoid';
import { generateInstancePath, generateInstanceToken } from '../utils/instancePathGenerator';

/**
 * Instance with user information (includes user_slug and user_email from authUser table)
 */
export interface InstanceWithUser {
  id: string;
  installation_id: string;
  user_id: string;
  user_slug: string;
  user_email: string;
  instance_path: string | null;
  instance_token: string | null;
  status: string;
  status_message: string | null;
  status_updated_at: Date | null;
  last_health_check_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * MCP Instance Service
 *
 * Manages per-user MCP server instances with granular status tracking.
 * Each user in a team gets their own instance of an installation.
 */
export class McpInstanceService {
  private db: AnyDatabase;
  private logger: FastifyBaseLogger;

  constructor(db: AnyDatabase, logger: FastifyBaseLogger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Create a new instance for a user
   *
   * @param installationId - Installation ID
   * @param userId - User ID
   * @param status - Initial status (default: 'provisioning')
   * @returns Object with instanceId, instancePath, and instanceToken (plaintext)
   */
  async createInstance(
    installationId: string,
    userId: string,
    status: string = 'provisioning',
    statusMessage?: string
  ): Promise<{ instanceId: string; instancePath: string; instanceToken: string }> {
    const schema = await import('../db/schema');
    const { mcpServerInstances } = schema;

    const instanceId = `inst_${nanoid()}`;

    const MAX_PATH_RETRIES = 5;
    let instancePath = '';
    let instanceToken: string;
    let instanceTokenEncrypted: string;
    let inserted = false;

    // Generate token once (outside retry loop)
    const tokenResult = await generateInstanceToken(this.logger);
    instanceToken = tokenResult.plaintext;
    instanceTokenEncrypted = tokenResult.encrypted;

    for (let attempt = 0; attempt < MAX_PATH_RETRIES; attempt++) {
      instancePath = generateInstancePath();

      try {
        await this.db.insert(mcpServerInstances).values({
          id: instanceId,
          installation_id: installationId,
          user_id: userId,
          instance_path: instancePath,
          instance_token: instanceTokenEncrypted, // Store AES-256-GCM encrypted token
          status,
          status_message: statusMessage,
          status_updated_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        });
        inserted = true;
        break;
      } catch (error: any) {
        // Check if it's a unique constraint violation on instance_path
        if (error.code === '23505' && error.constraint?.includes('instance_path')) {
          this.logger.warn({
            attempt: attempt + 1,
            instancePath
          }, 'Instance path collision detected, retrying with new path');
          continue;
        }
        // Re-throw non-uniqueness errors
        throw error;
      }
    }

    if (!inserted) {
      throw new Error(`Failed to generate unique instance path after ${MAX_PATH_RETRIES} retries`);
    }

    this.logger.info({
      operation: 'create_instance',
      instanceId,
      installationId,
      userId,
      instancePath,
      status,
      statusMessage
    }, 'Created MCP server instance with path-based access');

    return { instanceId, instancePath, instanceToken };
  }

  /**
   * Delete all instances for an installation
   * (Used when installation is deleted - but CASCADE handles this automatically)
   *
   * @param installationId - Installation ID
   * @returns Number of instances deleted
   */
  async deleteInstancesByInstallation(installationId: string): Promise<number> {
    const schema = await import('../db/schema');
    const { mcpServerInstances } = schema;

    const result = await this.db
      .delete(mcpServerInstances)
      .where(eq(mcpServerInstances.installation_id, installationId));

    const deletedCount = (result as { rowCount?: number }).rowCount || 0;

    this.logger.info({
      operation: 'delete_instances_by_installation',
      installationId,
      deletedCount
    }, `Deleted ${deletedCount} instances for installation`);

    return deletedCount;
  }

  /**
   * Delete all instances for a user in a specific team
   * (Used when user is removed from team)
   *
   * @param userId - User ID
   * @param teamId - Team ID
   * @returns Number of instances deleted
   */
  async deleteInstancesByUserInTeam(userId: string, teamId: string): Promise<number> {
    const schema = await import('../db/schema');
    const { mcpServerInstances, mcpServerInstallations } = schema;

    // Get all installation IDs for this team
    const teamInstallations = await this.db
      .select({ id: mcpServerInstallations.id })
      .from(mcpServerInstallations)
      .where(eq(mcpServerInstallations.team_id, teamId));

    if (teamInstallations.length === 0) {
      this.logger.debug({
        operation: 'delete_instances_by_user_in_team',
        userId,
        teamId
      }, 'No installations found for team - skipping instance deletion');
      return 0;
    }

    const installationIds = teamInstallations.map(i => i.id);

    // Delete instances for this user in these installations
    const result = await this.db
      .delete(mcpServerInstances)
      .where(
        and(
          eq(mcpServerInstances.user_id, userId),
          inArray(mcpServerInstances.installation_id, installationIds)
        )
      );

    const deletedCount = (result as { rowCount?: number }).rowCount || 0;

    this.logger.info({
      operation: 'delete_instances_by_user_in_team',
      userId,
      teamId,
      deletedCount,
      installationCount: installationIds.length
    }, `Deleted ${deletedCount} instances for user in team`);

    return deletedCount;
  }

  /**
   * Update instance status (strict validation - instance must exist)
   *
   * @param installationId - Installation ID
   * @param userId - User ID
   * @param status - New status
   * @param statusMessage - Optional status message
   * @returns True if updated, false if instance not found
   */
  async updateInstanceStatus(
    installationId: string,
    userId: string,
    status: string,
    statusMessage?: string
  ): Promise<boolean> {
    const schema = await import('../db/schema');
    const { mcpServerInstances } = schema;

    const result = await this.db
      .update(mcpServerInstances)
      .set({
        status,
        status_message: statusMessage || null,
        status_updated_at: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(mcpServerInstances.installation_id, installationId),
          eq(mcpServerInstances.user_id, userId)
        )
      );

    const rowsAffected = (result as { rowCount?: number }).rowCount || 0;

    if (rowsAffected === 0) {
      this.logger.warn({
        operation: 'update_instance_status',
        installationId,
        userId,
        status,
        statusMessage
      }, 'Instance not found for status update');
      return false;
    }

    this.logger.debug({
      operation: 'update_instance_status',
      installationId,
      userId,
      status,
      statusMessage
    }, 'Instance status updated');

    return true;
  }

  /**
   * Reset the instance token for a specific user's instance
   *
   * Generates a new token, encrypts it, and updates the database.
   * Only the instance belonging to the specified user is affected.
   *
   * @param installationId - Installation ID
   * @param userId - User ID (only this user's instance is updated)
   * @returns Object with instanceId and new plaintext token, or null if no matching instance
   */
  async resetInstanceToken(
    installationId: string,
    userId: string
  ): Promise<{ instanceId: string; instanceToken: string } | null> {
    const schema = await import('../db/schema');
    const { mcpServerInstances } = schema;

    // Generate new token
    const tokenResult = await generateInstanceToken(this.logger);

    // Update the instance token for this user's instance
    const result = await this.db
      .update(mcpServerInstances)
      .set({
        instance_token: tokenResult.encrypted,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(mcpServerInstances.installation_id, installationId),
          eq(mcpServerInstances.user_id, userId)
        )
      )
      .returning({ id: mcpServerInstances.id });

    if (!result || result.length === 0) {
      this.logger.warn({
        operation: 'reset_instance_token',
        installationId,
        userId
      }, 'No instance found for token reset');
      return null;
    }

    this.logger.info({
      operation: 'reset_instance_token',
      instanceId: result[0].id,
      installationId,
      userId
    }, 'Instance token reset successfully');

    return {
      instanceId: result[0].id,
      instanceToken: tokenResult.plaintext
    };
  }

  /**
   * Get all instances for an installation
   *
   * @param installationId - Installation ID
   * @returns Array of instances
   */
  async getInstancesByInstallation(installationId: string): Promise<any[]> {
    const schema = await import('../db/schema');
    const { mcpServerInstances } = schema;

    const instances = await this.db
      .select()
      .from(mcpServerInstances)
      .where(eq(mcpServerInstances.installation_id, installationId));

    return instances;
  }

  /**
   * Get all instances for an installation with user information
   * Joins with authUser to include user_slug for API responses
   *
   * @param installationId - Installation ID
   * @param teamId - Team ID (for security validation)
   * @returns Array of instances with user details
   */
  async getInstancesWithUsersByInstallation(
    installationId: string,
    teamId: string
  ): Promise<InstanceWithUser[]> {
    const schema = await import('../db/schema');
    const { mcpServerInstances, mcpServerInstallations, authUser } = schema;

    const instances = await this.db
      .select({
        id: mcpServerInstances.id,
        installation_id: mcpServerInstances.installation_id,
        user_id: mcpServerInstances.user_id,
        user_slug: authUser.username,
        user_email: authUser.email,
        instance_path: mcpServerInstances.instance_path,
        instance_token: mcpServerInstances.instance_token,
        status: mcpServerInstances.status,
        status_message: mcpServerInstances.status_message,
        status_updated_at: mcpServerInstances.status_updated_at,
        last_health_check_at: mcpServerInstances.last_health_check_at,
        created_at: mcpServerInstances.created_at,
        updated_at: mcpServerInstances.updated_at,
      })
      .from(mcpServerInstances)
      .innerJoin(authUser, eq(mcpServerInstances.user_id, authUser.id))
      .innerJoin(
        mcpServerInstallations,
        eq(mcpServerInstances.installation_id, mcpServerInstallations.id)
      )
      .where(
        and(
          eq(mcpServerInstances.installation_id, installationId),
          eq(mcpServerInstallations.team_id, teamId)
        )
      );

    return instances;
  }

}
