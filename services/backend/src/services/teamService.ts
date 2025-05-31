/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and, count } from 'drizzle-orm';
import { getDb, getSchema } from '../db/index';
import { generateId } from 'lucia';

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  owner_id: string;
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
}

export interface UpdateTeamData {
  name?: string;
  slug?: string;
  description?: string;
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
   * Check if user can create more teams (max 3)
   */
  static async canUserCreateTeam(userId: string): Promise<boolean> {
    const teamCount = await this.getUserTeamCount(userId);
    return teamCount < 3;
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
   * Create a team automatically for a new user (called during registration)
   */
  static async createDefaultTeamForUser(userId: string, username: string): Promise<Team> {
    return this.createTeam({
      name: username,
      owner_id: userId,
      description: `${username}'s team`,
    });
  }
}
