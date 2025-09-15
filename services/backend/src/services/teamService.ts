/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and, count } from 'drizzle-orm';
import { getDb, getSchema } from '../db/index';
import { generateId } from 'lucia';
import { GlobalSettings } from '../global-settings/helpers';
import type { FastifyBaseLogger } from 'fastify';

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  owner_id: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TeamMembership {
  id: string;
  team_id: string;
  user_id: string;
  role: 'team_admin' | 'team_user';
  joined_at: Date;
}

export interface CreateTeamData {
  name: string;
  slug?: string;
  description?: string;
  owner_id: string;
  is_default?: boolean;
}

export interface UpdateTeamData {
  name?: string;
  slug?: string;
  description?: string | null;
}

export interface TeamMemberWithUser {
  id: string;
  user_id: string;
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: 'team_admin' | 'team_user';
  is_admin: boolean;
  is_owner: boolean;
  joined_at: Date;
}

export interface UserTeamWithRole {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  owner_id: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
  role: 'team_admin' | 'team_user';
  is_admin: boolean;
  is_owner: boolean;
  member_count: number;
}

interface AutoInstallServerInfo {
  id: string;
  name: string;
  slug: string;
}

export class TeamService {
  private static getDbAndSchema() {
    return {
      db: getDb(),
      schema: getSchema(),
    };
  }

  /**
   * Generate a unique slug from a team name
   */
  static async generateUniqueSlug(baseName: string): Promise<string> {
    const baseSlug = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    let slug = baseSlug;
    let counter = 1;
    
    // Check if slug exists and increment until we find a unique one
    while (await this.slugExists(slug)) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
    
    return slug;
  }

  /**
   * Check if a slug already exists
   */
  static async slugExists(slug: string): Promise<boolean> {
    const { db, schema } = this.getDbAndSchema();
    const result = await (db as any)
      .select({ count: count() })
      .from(schema.teams)
      .where(eq(schema.teams.slug, slug));
    
    return result[0].count > 0;
  }

  /**
   * Create a new team
   */
  static async createTeam(data: CreateTeamData): Promise<Team> {
    const { db, schema } = this.getDbAndSchema();
    const teamId = generateId(15);
    const slug = data.slug || await this.generateUniqueSlug(data.name);
    const now = new Date();

    // Create the team
    const teamData = {
      id: teamId,
      name: data.name,
      slug,
      description: data.description || null,
      owner_id: data.owner_id,
      is_default: data.is_default || false,
      created_at: now,
      updated_at: now,
    };

    await (db as any).insert(schema.teams).values(teamData);

    // Add the owner as team_admin
    const membershipId = generateId(15);
    await (db as any).insert(schema.teamMemberships).values({
      id: membershipId,
      team_id: teamId,
      user_id: data.owner_id,
      role: 'team_admin',
      joined_at: now,
    });

    return teamData;
  }

  /**
   * Get team by ID
   */
  static async getTeamById(teamId: string): Promise<Team | null> {
    const { db, schema } = this.getDbAndSchema();
    const result = await (db as any)
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.id, teamId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get team by slug
   */
  static async getTeamBySlug(slug: string): Promise<Team | null> {
    const { db, schema } = this.getDbAndSchema();
    const result = await (db as any)
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.slug, slug))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get all teams for a user
   */
  static async getUserTeams(userId: string): Promise<Team[]> {
    const { db, schema } = this.getDbAndSchema();
    const result = await (db as any)
      .select({
        id: schema.teams.id,
        name: schema.teams.name,
        slug: schema.teams.slug,
        description: schema.teams.description,
        owner_id: schema.teams.owner_id,
        is_default: schema.teams.is_default,
        created_at: schema.teams.created_at,
        updated_at: schema.teams.updated_at,
      })
      .from(schema.teams)
      .innerJoin(
        schema.teamMemberships,
        eq(schema.teams.id, schema.teamMemberships.team_id)
      )
      .where(eq(schema.teamMemberships.user_id, userId));

    return result;
  }

  /**
   * Get user's team count
   */
  static async getUserTeamCount(userId: string): Promise<number> {
    const { db, schema } = this.getDbAndSchema();
    const result = await (db as any)
      .select({ count: count() })
      .from(schema.teamMemberships)
      .where(eq(schema.teamMemberships.user_id, userId));

    return result[0].count;
  }

  /**
   * Check if user can create more teams (dynamic limit from global settings)
   */
  static async canUserCreateTeam(userId: string): Promise<boolean> {
    const teamCount = await this.getUserTeamCount(userId);
    const teamLimit = await GlobalSettings.getNumber('global.team_creation_limit', 3);
    return teamCount < teamLimit;
  }

  /**
   * Update team
   */
  static async updateTeam(teamId: string, data: UpdateTeamData): Promise<Team | null> {
    const { db, schema } = this.getDbAndSchema();
    const updateData: any = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;

    await (db as any)
      .update(schema.teams)
      .set(updateData)
      .where(eq(schema.teams.id, teamId));

    return this.getTeamById(teamId);
  }

  /**
   * Delete team
   */
  static async deleteTeam(teamId: string): Promise<boolean> {
    const { db, schema } = this.getDbAndSchema();
    // Delete team memberships first (cascade should handle this, but being explicit)
    await (db as any)
      .delete(schema.teamMemberships)
      .where(eq(schema.teamMemberships.team_id, teamId));

    // Delete the team
    const result = await (db as any)
      .delete(schema.teams)
      .where(eq(schema.teams.id, teamId));

    return result.changes > 0;
  }

  /**
   * Get team membership for a user in a specific team
   */
  static async getTeamMembership(teamId: string, userId: string): Promise<TeamMembership | null> {
    const { db, schema } = this.getDbAndSchema();
    const result = await (db as any)
      .select()
      .from(schema.teamMemberships)
      .where(
        and(
          eq(schema.teamMemberships.team_id, teamId),
          eq(schema.teamMemberships.user_id, userId)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Check if user is team admin
   */
  static async isTeamAdmin(teamId: string, userId: string): Promise<boolean> {
    const membership = await this.getTeamMembership(teamId, userId);
    return membership?.role === 'team_admin';
  }

  /**
   * Check if user is team owner
   */
  static async isTeamOwner(teamId: string, userId: string): Promise<boolean> {
    const team = await this.getTeamById(teamId);
    return team?.owner_id === userId;
  }

  /**
   * Get all team members
   */
  static async getTeamMembers(teamId: string): Promise<TeamMembership[]> {
    const { db, schema } = this.getDbAndSchema();
    const result = await (db as any)
      .select()
      .from(schema.teamMemberships)
      .where(eq(schema.teamMemberships.team_id, teamId));

    return result;
  }

  /**
   * Check if user is a member of a team
   */
  static async isTeamMember(teamId: string, userId: string): Promise<boolean> {
    const membership = await this.getTeamMembership(teamId, userId);
    return membership !== null;
  }

  /**
   * Check if a team is a user's default team
   */
  static async isDefaultTeam(teamId: string, userId: string): Promise<boolean> {
    const team = await this.getTeamById(teamId);
    if (!team || team.owner_id !== userId) {
      return false;
    }

    // Get user to check if team name matches username (indicating default team)
    const { db, schema } = this.getDbAndSchema();
    const userResult = await (db as any)
      .select({ username: schema.authUser.username })
      .from(schema.authUser)
      .where(eq(schema.authUser.id, userId))
      .limit(1);

    if (!userResult[0]) {
      return false;
    }

    // Check if team name or slug matches username
    const username = userResult[0].username;
    return team.name === username || team.slug === username;
  }

  /**
   * Get user's default team
   */
  static async getUserDefaultTeam(userId: string): Promise<Team | null> {
    const { db, schema } = this.getDbAndSchema();
    const result = await (db as any)
      .select()
      .from(schema.teams)
      .innerJoin(
        schema.teamMemberships,
        eq(schema.teams.id, schema.teamMemberships.team_id)
      )
      .where(
        and(
          eq(schema.teamMemberships.user_id, userId),
          eq(schema.teams.is_default, true)
        )
      )
      .limit(1);

    return result[0]?.teams || null;
  }

  /**
   * Create a team automatically for a new user (called during registration)
   * Also auto-installs MCP servers marked for auto-installation
   */
  static async createDefaultTeamForUser(userId: string, username: string, logger?: FastifyBaseLogger): Promise<Team> {
    // First create the team
    const team = await this.createTeam({
      name: username,
      owner_id: userId,
      description: `${username}'s team`,
      is_default: true,
    });

    // Auto-install MCP servers marked for new default teams
    try {
      await this.autoInstallMcpServersForDefaultTeam(team.id, userId, logger);
    } catch (error) {
      // Log error but don't fail team creation
      if (logger) {
        logger.warn({
          error,
          teamId: team.id,
          userId,
          operation: 'auto_install_mcp_servers'
        }, 'Failed to auto-install MCP servers for new default team');
      }
    }

    return team;
  }

  /**
   * Auto-install MCP servers marked for new default teams
   */
  private static async autoInstallMcpServersForDefaultTeam(
    teamId: string, 
    userId: string, 
    logger?: FastifyBaseLogger
  ): Promise<void> {
    const { db, schema } = this.getDbAndSchema();

    if (logger) {
      logger.debug({
        operation: 'auto_install_mcp_servers',
        teamId,
        userId
      }, 'Starting auto-installation of MCP servers for new default team');
    }

    // Query for global MCP servers marked for auto-installation
    const autoInstallServers: AutoInstallServerInfo[] = await (db as any)
      .select({
        id: schema.mcpServers.id,
        name: schema.mcpServers.name,
        slug: schema.mcpServers.slug
      })
      .from(schema.mcpServers)
      .where(
        and(
          eq(schema.mcpServers.auto_install_new_default_team, true),
          eq(schema.mcpServers.visibility, 'global'),
          eq(schema.mcpServers.status, 'active')
        )
      );

    if (autoInstallServers.length === 0) {
      if (logger) {
        logger.debug({
          operation: 'auto_install_mcp_servers',
          teamId,
          userId
        }, 'No MCP servers marked for auto-installation found');
      }
      return;
    }

    if (logger) {
      logger.info({
        operation: 'auto_install_mcp_servers',
        teamId,
        userId,
        serverCount: autoInstallServers.length,
        serverNames: autoInstallServers.map((s: AutoInstallServerInfo) => s.name)
      }, `Found ${autoInstallServers.length} MCP servers marked for auto-installation`);
    }

    // Import McpInstallationService dynamically to avoid circular dependencies
    const { McpInstallationService } = await import('./mcpInstallationService');
    const installationService = new McpInstallationService(db, logger || console as any);

    let successCount = 0;
    let errorCount = 0;

    // Install each server
    for (const server of autoInstallServers) {
      try {
        const installationName = server.name; // Use server name as installation name
        
        await installationService.createInstallation(
          teamId,
          userId,
          {
            server_id: server.id,
            installation_name: installationName,
            installation_type: 'global'
            // user_environment_variables will be empty initially
          }
        );

        successCount++;
        
        if (logger) {
          logger.debug({
            operation: 'auto_install_mcp_servers',
            teamId,
            userId,
            serverId: server.id,
            serverName: server.name,
            installationName
          }, `Successfully auto-installed MCP server: ${server.name}`);
        }
      } catch (error) {
        errorCount++;
        
        if (logger) {
          logger.warn({
            error,
            operation: 'auto_install_mcp_servers',
            teamId,
            userId,
            serverId: server.id,
            serverName: server.name
          }, `Failed to auto-install MCP server: ${server.name}`);
        }
      }
    }

    if (logger) {
      logger.info({
        operation: 'auto_install_mcp_servers',
        teamId,
        userId,
        totalServers: autoInstallServers.length,
        successCount,
        errorCount
      }, `Auto-installation completed: ${successCount} successful, ${errorCount} failed`);
    }
  }

  // ===== TEAM MEMBER MANAGEMENT METHODS =====

  /**
   * Get team member count
   */
  static async getTeamMemberCount(teamId: string): Promise<number> {
    const { db, schema } = this.getDbAndSchema();
    const result = await (db as any)
      .select({ count: count() })
      .from(schema.teamMemberships)
      .where(eq(schema.teamMemberships.team_id, teamId));

    return result[0].count;
  }

  /**
   * Get team admin count
   */
  static async getTeamAdminCount(teamId: string): Promise<number> {
    const { db, schema } = this.getDbAndSchema();
    const result = await (db as any)
      .select({ count: count() })
      .from(schema.teamMemberships)
      .where(
        and(
          eq(schema.teamMemberships.team_id, teamId),
          eq(schema.teamMemberships.role, 'team_admin')
        )
      );

    return result[0].count;
  }

  /**
   * Check if team is a default team (using is_default flag)
   */
  static async isTeamDefault(teamId: string): Promise<boolean> {
    const team = await this.getTeamById(teamId);
    return team?.is_default || false;
  }

  /**
   * Check if user can add member to team
   */
  static async canAddMemberToTeam(teamId: string): Promise<boolean> {
    // Check if team is default (cannot add members to default teams)
    if (await this.isTeamDefault(teamId)) {
      return false;
    }

    // Get team member limit from global settings
    const memberLimit = await GlobalSettings.getNumber('global.team_member_limit', 3);
    
    // Check if team has less than the configured limit
    const memberCount = await this.getTeamMemberCount(teamId);
    return memberCount < memberLimit;
  }

  /**
   * Check if user can be removed from team
   */
  static async canRemoveMemberFromTeam(teamId: string, userId: string): Promise<boolean> {
    // Cannot remove from default teams
    if (await this.isTeamDefault(teamId)) {
      return false;
    }

    // Cannot remove if it would leave team with 0 members
    const memberCount = await this.getTeamMemberCount(teamId);
    if (memberCount <= 1) {
      return false;
    }

    // Cannot remove team owner
    if (await this.isTeamOwner(teamId, userId)) {
      return false;
    }

    return true;
  }

  /**
   * Check if user can manage another team member
   */
  static async canUserManageTeamMember(
    teamId: string, 
    managerId: string, 
    targetUserId: string, 
    action: 'add' | 'remove' | 'change_role'
  ): Promise<boolean> {
    // Global admin can do anything (this will be checked in the route handler)
    
    // Default teams are protected
    if (await this.isTeamDefault(teamId)) {
      return false;
    }

    // Team owner can manage anyone (except remove themselves)
    if (await this.isTeamOwner(teamId, managerId)) {
      if (action === 'remove' && managerId === targetUserId) {
        return false; // Owner cannot remove themselves
      }
      return true;
    }

    // Team admin can only manage team_users
    if (await this.isTeamAdmin(teamId, managerId)) {
      const targetMembership = await this.getTeamMembership(teamId, targetUserId);
      if (!targetMembership) {
        return action === 'add'; // Can add new members
      }
      
      // Cannot manage other team_admins or the owner
      if (targetMembership.role === 'team_admin' || await this.isTeamOwner(teamId, targetUserId)) {
        return false;
      }
      
      return true; // Can manage team_users
    }

    return false;
  }

  /**
   * Add member to team
   */
  static async addTeamMember(teamId: string, userId: string, role: 'team_admin' | 'team_user'): Promise<TeamMembership> {
    const { db, schema } = this.getDbAndSchema();

    // Validate team exists
    const team = await this.getTeamById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Validate user exists
    const userResult = await (db as any)
      .select({ id: schema.authUser.id })
      .from(schema.authUser)
      .where(eq(schema.authUser.id, userId))
      .limit(1);

    if (!userResult[0]) {
      throw new Error('User not found');
    }

    // Check if user is already a member
    const existingMembership = await this.getTeamMembership(teamId, userId);
    if (existingMembership) {
      throw new Error('User is already a member of this team');
    }

    // Check if team can accept new members
    if (!(await this.canAddMemberToTeam(teamId))) {
      if (await this.isTeamDefault(teamId)) {
        throw new Error('Cannot add members to default teams');
      } else {
        // Get the actual limit for the error message
        const memberLimit = await GlobalSettings.getNumber('global.team_member_limit', 3);
        throw new Error(`Team has reached maximum capacity (${memberLimit} members)`);
      }
    }

    // Add the member
    const membershipId = generateId(15);
    const membershipData = {
      id: membershipId,
      team_id: teamId,
      user_id: userId,
      role,
      joined_at: new Date(),
    };

    await (db as any).insert(schema.teamMemberships).values(membershipData);

    return membershipData;
  }

  /**
   * Remove member from team
   */
  static async removeTeamMember(teamId: string, userId: string): Promise<boolean> {
    const { db, schema } = this.getDbAndSchema();

    // Validate member exists
    const membership = await this.getTeamMembership(teamId, userId);
    if (!membership) {
      throw new Error('User is not a member of this team');
    }

    // Check if member can be removed
    if (!(await this.canRemoveMemberFromTeam(teamId, userId))) {
      if (await this.isTeamDefault(teamId)) {
        throw new Error('Cannot remove members from default teams');
      } else if (await this.isTeamOwner(teamId, userId)) {
        throw new Error('Cannot remove team owner. Transfer ownership first.');
      } else {
        throw new Error('Cannot remove last member from team');
      }
    }

    // Remove the member
    const result = await (db as any)
      .delete(schema.teamMemberships)
      .where(
        and(
          eq(schema.teamMemberships.team_id, teamId),
          eq(schema.teamMemberships.user_id, userId)
        )
      );

    return result.changes > 0;
  }

  /**
   * Update member role
   */
  static async updateMemberRole(teamId: string, userId: string, newRole: 'team_admin' | 'team_user'): Promise<TeamMembership | null> {
    const { db, schema } = this.getDbAndSchema();

    // Validate member exists
    const membership = await this.getTeamMembership(teamId, userId);
    if (!membership) {
      throw new Error('User is not a member of this team');
    }

    // Cannot change roles in default teams
    if (await this.isTeamDefault(teamId)) {
      throw new Error('Cannot change member roles in default teams');
    }

    // If demoting from team_admin, ensure at least one admin remains
    if (membership.role === 'team_admin' && newRole === 'team_user') {
      const adminCount = await this.getTeamAdminCount(teamId);
      if (adminCount <= 1) {
        throw new Error('Cannot demote last team admin. Promote another member first.');
      }
    }

    // Update the role
    await (db as any)
      .update(schema.teamMemberships)
      .set({ role: newRole })
      .where(
        and(
          eq(schema.teamMemberships.team_id, teamId),
          eq(schema.teamMemberships.user_id, userId)
        )
      );

    return this.getTeamMembership(teamId, userId);
  }

  /**
   * Transfer team ownership
   */
  static async transferOwnership(teamId: string, newOwnerId: string): Promise<boolean> {
    const { db, schema } = this.getDbAndSchema();

    // Validate team exists
    const team = await this.getTeamById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Cannot transfer ownership of default teams
    if (team.is_default) {
      throw new Error('Cannot transfer ownership of default teams');
    }

    // Validate new owner is a team member
    const newOwnerMembership = await this.getTeamMembership(teamId, newOwnerId);
    if (!newOwnerMembership) {
      throw new Error('New owner must be a team member');
    }

    // Update team ownership
    await (db as any)
      .update(schema.teams)
      .set({ 
        owner_id: newOwnerId,
        updated_at: new Date()
      })
      .where(eq(schema.teams.id, teamId));

    // Ensure new owner has team_admin role
    if (newOwnerMembership.role !== 'team_admin') {
      await this.updateMemberRole(teamId, newOwnerId, 'team_admin');
    }

    return true;
  }

  /**
   * Get user teams with role information
   */
  static async getUserTeamsWithRoles(userId: string): Promise<UserTeamWithRole[]> {
    const { db, schema } = this.getDbAndSchema();
    
    const result = await (db as any)
      .select({
        // Team fields
        id: schema.teams.id,
        name: schema.teams.name,
        slug: schema.teams.slug,
        description: schema.teams.description,
        owner_id: schema.teams.owner_id,
        is_default: schema.teams.is_default,
        created_at: schema.teams.created_at,
        updated_at: schema.teams.updated_at,
        // User's role in team
        role: schema.teamMemberships.role,
      })
      .from(schema.teams)
      .innerJoin(schema.teamMemberships, eq(schema.teams.id, schema.teamMemberships.team_id))
      .where(eq(schema.teamMemberships.user_id, userId));

    // Add computed fields
    const teamsWithRoles = await Promise.all(
      result.map(async (team: any) => ({
        ...team,
        is_admin: team.role === 'team_admin',
        is_owner: team.owner_id === userId,
        member_count: await this.getTeamMemberCount(team.id)
      }))
    );

    return teamsWithRoles;
  }

  /**
   * Get team members with user information
   */
  static async getTeamMembersWithUserInfo(teamId: string): Promise<TeamMemberWithUser[]> {
    const { db, schema } = this.getDbAndSchema();
    
    const result = await (db as any)
      .select({
        id: schema.teamMemberships.id,
        user_id: schema.teamMemberships.user_id,
        role: schema.teamMemberships.role,
        joined_at: schema.teamMemberships.joined_at,
        username: schema.authUser.username,
        email: schema.authUser.email,
        first_name: schema.authUser.first_name,
        last_name: schema.authUser.last_name,
      })
      .from(schema.teamMemberships)
      .innerJoin(schema.authUser, eq(schema.teamMemberships.user_id, schema.authUser.id))
      .where(eq(schema.teamMemberships.team_id, teamId));

    // Get team owner_id
    const team = await this.getTeamById(teamId);
    const ownerId = team?.owner_id;

    // Add computed fields
    return result.map((member: any) => ({
      ...member,
      is_admin: member.role === 'team_admin',
      is_owner: member.user_id === ownerId
    }));
  }
}
