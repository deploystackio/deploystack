import { getDb, getSchema } from '../db';
import { eq } from 'drizzle-orm';
import { RoleService } from './roleService';

export interface User {
  id: string;
  username: string;
  email: string;
  auth_type: string;
  first_name: string | null;
  last_name: string | null;
  github_id: string | null;
  role_id: string | null;
  role?: {
    id: string;
    name: string;
    permissions: string[];
  };
}

export interface UpdateUserInput {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role_id?: string;
}

export class UserService {
  private roleService = new RoleService();

  private getDbAndSchema() {
    return {
      db: getDb(),
      schema: getSchema()
    };
  }

  /**
   * Get all users with their roles
   */
  async getAllUsers(): Promise<User[]> {
    const { db, schema } = this.getDbAndSchema();
    const authUserTable = schema.authUser;
    const rolesTable = schema.roles;

    const usersWithRoles = await (db as any)
      .select({
        user: authUserTable,
        role: rolesTable,
      })
      .from(authUserTable)
      .leftJoin(rolesTable, eq(authUserTable.role_id, rolesTable.id));

    return usersWithRoles.map((row: any) => ({
      id: row.user.id,
      username: row.user.username,
      email: row.user.email,
      auth_type: row.user.auth_type,
      first_name: row.user.first_name,
      last_name: row.user.last_name,
      github_id: row.user.github_id,
      role_id: row.user.role_id,
      role: row.role ? {
        id: row.role.id,
        name: row.role.name,
        permissions: JSON.parse(row.role.permissions),
      } : undefined,
    }));
  }

  /**
   * Get user by ID with role information
   */
  async getUserById(id: string): Promise<User | null> {
    const { db, schema } = this.getDbAndSchema();
    const authUserTable = schema.authUser;
    const rolesTable = schema.roles;

    const usersWithRoles = await (db as any)
      .select({
        user: authUserTable,
        role: rolesTable,
      })
      .from(authUserTable)
      .leftJoin(rolesTable, eq(authUserTable.role_id, rolesTable.id))
      .where(eq(authUserTable.id, id))
      .limit(1);

    if (usersWithRoles.length === 0) return null;

    const row = usersWithRoles[0];
    return {
      id: row.user.id,
      username: row.user.username,
      email: row.user.email,
      auth_type: row.user.auth_type,
      first_name: row.user.first_name,
      last_name: row.user.last_name,
      github_id: row.user.github_id,
      role_id: row.user.role_id,
      role: row.role ? {
        id: row.role.id,
        name: row.role.name,
        permissions: JSON.parse(row.role.permissions),
      } : undefined,
    };
  }

  /**
   * Update user information
   */
  async updateUser(id: string, input: UpdateUserInput): Promise<User | null> {
    const { db, schema } = this.getDbAndSchema();
    const authUserTable = schema.authUser;

    // Check if user exists
    const existingUser = await this.getUserById(id);
    if (!existingUser) return null;

    // If role_id is being updated, verify the role exists
    if (input.role_id !== undefined) {
      const role = await this.roleService.getRoleById(input.role_id);
      if (!role) {
        throw new Error('Invalid role ID');
      }
    }

    // Check for username/email conflicts
    if (input.username || input.email) {
      const conflicts = await (db as any)
        .select()
        .from(authUserTable)
        .where(
          input.username && input.email
            ? eq(authUserTable.username, input.username) || eq(authUserTable.email, input.email)
            : input.username
            ? eq(authUserTable.username, input.username)
            : eq(authUserTable.email, input.email!)
        )
        .limit(1);

      if (conflicts.length > 0 && conflicts[0].id !== id) {
        throw new Error('Username or email already exists');
      }
    }

    const updateData: any = {};
    if (input.username !== undefined) updateData.username = input.username;
    if (input.email !== undefined) updateData.email = input.email.toLowerCase();
    if (input.first_name !== undefined) updateData.first_name = input.first_name;
    if (input.last_name !== undefined) updateData.last_name = input.last_name;
    if (input.role_id !== undefined) updateData.role_id = input.role_id;

    await (db as any)
      .update(authUserTable)
      .set(updateData)
      .where(eq(authUserTable.id, id));

    return this.getUserById(id);
  }

  /**
   * Delete user (only if not the last admin)
   */
  async deleteUser(id: string): Promise<boolean> {
    const { db, schema } = this.getDbAndSchema();
    const authUserTable = schema.authUser;

    // Check if user exists
    const user = await this.getUserById(id);
    if (!user) return false;

    // If user is global_admin, check if there are other admins
    if (user.role_id === 'global_admin') {
      const adminCount = await (db as any)
        .select()
        .from(authUserTable)
        .where(eq(authUserTable.role_id, 'global_admin'));

      if (adminCount.length <= 1) {
        throw new Error('Cannot delete the last global administrator');
      }
    }

    // Delete user sessions first (cascade should handle this, but being explicit)
    const authSessionTable = schema.authSession;
    await (db as any)
      .delete(authSessionTable)
      .where(eq(authSessionTable.user_id, id));

    // Delete user
    await (db as any)
      .delete(authUserTable)
      .where(eq(authUserTable.id, id));

    return true;
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string): Promise<boolean> {
    return this.roleService.assignRoleToUser(userId, roleId);
  }

  /**
   * Check if user has permission
   */
  async userHasPermission(userId: string, permission: string): Promise<boolean> {
    return this.roleService.userHasPermission(userId, permission);
  }

  /**
   * Get user count by role
   */
  async getUserCountByRole(): Promise<Record<string, number>> {
    const { db, schema } = this.getDbAndSchema();
    const authUserTable = schema.authUser;

    const counts = await (db as any)
      .select({
        role_id: authUserTable.role_id,
        count: 'COUNT(*)',
      })
      .from(authUserTable)
      .groupBy(authUserTable.role_id);

    const result: Record<string, number> = {};
    counts.forEach((row: any) => {
      result[row.role_id || 'no_role'] = parseInt(row.count);
    });

    return result;
  }

  /**
   * Get users by role
   */
  async getUsersByRole(roleId: string): Promise<User[]> {
    const { db, schema } = this.getDbAndSchema();
    const authUserTable = schema.authUser;
    const rolesTable = schema.roles;

    const usersWithRoles = await (db as any)
      .select({
        user: authUserTable,
        role: rolesTable,
      })
      .from(authUserTable)
      .leftJoin(rolesTable, eq(authUserTable.role_id, rolesTable.id))
      .where(eq(authUserTable.role_id, roleId));

    return usersWithRoles.map((row: any) => ({
      id: row.user.id,
      username: row.user.username,
      email: row.user.email,
      auth_type: row.user.auth_type,
      first_name: row.user.first_name,
      last_name: row.user.last_name,
      github_id: row.user.github_id,
      role_id: row.user.role_id,
      role: row.role ? {
        id: row.role.id,
        name: row.role.name,
        permissions: JSON.parse(row.role.permissions),
      } : undefined,
    }));
  }
}
