import { type FastifyBaseLogger } from 'fastify';
import { getDb, getSchema } from '../db';
import { eq } from 'drizzle-orm';
import { RoleService } from './roleService';

export class RoleSyncService {
  private db;
  private schema;
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.db = getDb();
    this.schema = getSchema();
    this.logger = logger.child({ service: 'RoleSyncService' });
  }

  /**
   * Synchronize role permissions from code definitions to database
   * This ensures database roles match the getDefaultPermissions() definitions
   */
  async syncRoles(): Promise<void> {
    this.logger.debug({
      operation: 'role_sync_start'
    }, '🔄 Starting role synchronization...');

    try {
      const defaultPermissions = RoleService.getDefaultPermissions();
      const rolesTable = this.schema.roles;
      let totalUpdated = 0;

      // Process each role defined in code
      for (const [roleId, expectedPermissions] of Object.entries(defaultPermissions)) {
        this.logger.debug({
          operation: 'role_sync_check',
          roleId,
          expectedPermissionCount: expectedPermissions.length
        }, `Checking role: ${roleId}`);

        // Get current role from database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentRoles = await (this.db as any)
          .select()
          .from(rolesTable)
          .where(eq(rolesTable.id, roleId))
          .limit(1);

        if (currentRoles.length === 0) {
          this.logger.warn({
            operation: 'role_sync_missing',
            roleId
          }, `Role ${roleId} not found in database - skipping sync`);
          continue;
        }

        const currentRole = currentRoles[0];
        const currentPermissions = JSON.parse(currentRole.permissions);

        // Compare permissions
        const permissionsChanged = this.comparePermissions(
          currentPermissions,
          expectedPermissions,
          roleId
        );

        if (permissionsChanged) {
          // Update role permissions in database
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (this.db as any)
            .update(rolesTable)
            .set({
              permissions: JSON.stringify(expectedPermissions),
              updated_at: new Date()
            })
            .where(eq(rolesTable.id, roleId));

          totalUpdated++;

          this.logger.info({
            operation: 'role_sync_updated',
            roleId,
            permissionCount: expectedPermissions.length
          }, `✅ Updated permissions for role: ${roleId}`);
        } else {
          this.logger.debug({
            operation: 'role_sync_unchanged',
            roleId
          }, `Role ${roleId} permissions already up to date`);
        }
      }

      this.logger.info({
        operation: 'role_sync_completed',
        totalRoles: Object.keys(defaultPermissions).length,
        updatedRoles: totalUpdated
      }, `✅ Role synchronization completed - ${totalUpdated} roles updated`);

    } catch (error) {
      this.logger.error({
        operation: 'role_sync_error',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, '❌ Role synchronization failed');
      throw error;
    }
  }

  /**
   * Compare current permissions with expected permissions and log differences
   */
  private comparePermissions(
    currentPermissions: string[],
    expectedPermissions: string[],
    roleId: string
  ): boolean {
    const currentSet = new Set(currentPermissions);
    const expectedSet = new Set(expectedPermissions);

    // Find added permissions
    const addedPermissions = expectedPermissions.filter(p => !currentSet.has(p));
    
    // Find removed permissions
    const removedPermissions = currentPermissions.filter(p => !expectedSet.has(p));

    // Log changes if any
    if (addedPermissions.length > 0) {
      this.logger.debug({
        operation: 'role_sync_permissions_added',
        roleId,
        addedPermissions
      }, `Adding ${addedPermissions.length} permissions to ${roleId}: ${addedPermissions.join(', ')}`);
    }

    if (removedPermissions.length > 0) {
      this.logger.debug({
        operation: 'role_sync_permissions_removed',
        roleId,
        removedPermissions
      }, `Removing ${removedPermissions.length} permissions from ${roleId}: ${removedPermissions.join(', ')}`);
    }

    // Return true if there are any changes
    return addedPermissions.length > 0 || removedPermissions.length > 0;
  }

  /**
   * Get current role permissions from database for debugging
   */
  async getCurrentRolePermissions(): Promise<Record<string, string[]>> {
    const rolesTable = this.schema.roles;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roles = await (this.db as any).select().from(rolesTable);
    
    const result: Record<string, string[]> = {};
    for (const role of roles) {
      result[role.id] = JSON.parse(role.permissions);
    }
    
    return result;
  }
}
