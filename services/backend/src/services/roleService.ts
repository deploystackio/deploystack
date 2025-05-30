import { getDb, getSchema } from '../db';
import { eq } from 'drizzle-orm';

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system_role: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRoleInput {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
}

export class RoleService {
  private getDbAndSchema() {
    return {
      db: getDb(),
      schema: getSchema()
    };
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    const { db, schema } = this.getDbAndSchema();
    const rolesTable = schema.roles;
    const roles = await (db as any).select().from(rolesTable);
    
    return roles.map((role: any) => ({
      ...role,
      permissions: JSON.parse(role.permissions),
    }));
  }

  /**
   * Get role by ID
   */
  async getRoleById(id: string): Promise<Role | null> {
    const { db, schema } = this.getDbAndSchema();
    const rolesTable = schema.roles;
    const roles = await (db as any)
      .select()
      .from(rolesTable)
      .where(eq(rolesTable.id, id))
      .limit(1);

    if (roles.length === 0) return null;

    const role = roles[0];
    return {
      ...role,
      permissions: JSON.parse(role.permissions),
    };
  }

  /**
   * Create a new role
   */
  async createRole(input: CreateRoleInput): Promise<Role> {
    const { db, schema } = this.getDbAndSchema();
    const rolesTable = schema.roles;
    const now = new Date();

    const roleData = {
      id: input.id,
      name: input.name,
      description: input.description || null,
      permissions: JSON.stringify(input.permissions),
      is_system_role: false,
      created_at: now,
      updated_at: now,
    };

    await (db as any).insert(rolesTable).values(roleData);

    return {
      ...roleData,
      permissions: input.permissions,
    };
  }

  /**
   * Update an existing role
   */
  async updateRole(id: string, input: UpdateRoleInput): Promise<Role | null> {
    const { db, schema } = this.getDbAndSchema();
    const rolesTable = schema.roles;

    // Check if role exists and is not a system role
    const existingRole = await this.getRoleById(id);
    if (!existingRole) return null;
    if (existingRole.is_system_role) {
      throw new Error('Cannot update system roles');
    }

    const updateData: any = {
      updated_at: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.permissions !== undefined) updateData.permissions = JSON.stringify(input.permissions);

    await (db as any)
      .update(rolesTable)
      .set(updateData)
      .where(eq(rolesTable.id, id));

    return this.getRoleById(id);
  }

  /**
   * Delete a role (only non-system roles)
   */
  async deleteRole(id: string): Promise<boolean> {
    const { db, schema } = this.getDbAndSchema();
    const rolesTable = schema.roles;

    // Check if role exists and is not a system role
    const existingRole = await this.getRoleById(id);
    if (!existingRole) return false;
    if (existingRole.is_system_role) {
      throw new Error('Cannot delete system roles');
    }

    // Check if any users have this role
    const authUserTable = schema.authUser;
    const usersWithRole = await (db as any)
      .select()
      .from(authUserTable)
      .where(eq(authUserTable.role_id, id))
      .limit(1);

    if (usersWithRole.length > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }

    await (db as any).delete(rolesTable).where(eq(rolesTable.id, id));
    return true;
  }

  /**
   * Check if a user has a specific permission
   */
  async userHasPermission(userId: string, permission: string): Promise<boolean> {
    const { db, schema } = this.getDbAndSchema();
    const authUserTable = schema.authUser;
    const rolesTable = schema.roles;

    const userWithRole = await (db as any)
      .select({
        role_permissions: rolesTable.permissions,
      })
      .from(authUserTable)
      .leftJoin(rolesTable, eq(authUserTable.role_id, rolesTable.id))
      .where(eq(authUserTable.id, userId))
      .limit(1);

    if (userWithRole.length === 0 || !userWithRole[0].role_permissions) {
      return false;
    }

    const permissions = JSON.parse(userWithRole[0].role_permissions);
    return permissions.includes(permission);
  }

  /**
   * Get user's role and permissions
   */
  async getUserRole(userId: string): Promise<Role | null> {
    const { db, schema } = this.getDbAndSchema();
    const authUserTable = schema.authUser;
    const rolesTable = schema.roles;

    const userWithRole = await (db as any)
      .select({
        role: rolesTable,
      })
      .from(authUserTable)
      .leftJoin(rolesTable, eq(authUserTable.role_id, rolesTable.id))
      .where(eq(authUserTable.id, userId))
      .limit(1);

    if (userWithRole.length === 0 || !userWithRole[0].role) {
      return null;
    }

    const role = userWithRole[0].role;
    return {
      ...role,
      permissions: JSON.parse(role.permissions),
    };
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(userId: string, roleId: string): Promise<boolean> {
    const { db, schema } = this.getDbAndSchema();
    const authUserTable = schema.authUser;

    // Check if role exists
    const role = await this.getRoleById(roleId);
    if (!role) return false;

    // Check if user exists
    const users = await (db as any)
      .select()
      .from(authUserTable)
      .where(eq(authUserTable.id, userId))
      .limit(1);

    if (users.length === 0) return false;

    // Update user's role
    await (db as any)
      .update(authUserTable)
      .set({ role_id: roleId })
      .where(eq(authUserTable.id, userId));

    return true;
  }

  /**
   * Get default permissions for each role
   */
  static getDefaultPermissions() {
    return {
      global_admin: [
        'users.list',
        'users.view',
        'users.edit',
        'users.delete',
        'users.create',
        'roles.manage',
        'system.admin',
      ],
      global_user: [
        'profile.view',
        'profile.edit',
      ],
    };
  }
}
