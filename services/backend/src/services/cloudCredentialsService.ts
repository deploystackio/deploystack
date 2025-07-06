/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDb, getSchema } from '../db';
import { eq, and, or, like } from 'drizzle-orm';
import { generateId } from 'lucia';
import { encrypt, decrypt } from '../utils/encryption';
import { getCloudProvider, validateCredentialData, validateCredentialDataForUpdate } from '../config/cloud-providers';
import type { 
  StoredCredentials, 
  CloudCredentialResponse, 
  CloudCredentialBasicResponse,
  CreateCloudCredentialRequest, 
  UpdateCloudCredentialRequest 
} from '../types/cloud-providers';

export class CloudCredentialsService {
  private getDbAndSchema() {
    return {
      db: getDb(),
      schema: getSchema()
    };
  }

  /**
   * Get all cloud credentials for a team (full details for admins)
   */
  async getTeamCredentials(teamId: string): Promise<CloudCredentialResponse[]> {
    const { db, schema } = this.getDbAndSchema();
    const credentialsTable = schema.teamCloudCredentials;
    const authUserTable = schema.authUser;
    
    const credentials = await (db as any)
      .select({
        id: credentialsTable.id,
        team_id: credentialsTable.team_id,
        provider_id: credentialsTable.provider_id,
        name: credentialsTable.name,
        comment: credentialsTable.comment,
        credentials: credentialsTable.credentials,
        created_by: credentialsTable.created_by,
        created_at: credentialsTable.created_at,
        updated_at: credentialsTable.updated_at,
        // User information
        user_username: authUserTable.username,
        user_email: authUserTable.email,
      })
      .from(credentialsTable)
      .leftJoin(authUserTable, eq(credentialsTable.created_by, authUserTable.id))
      .where(eq(credentialsTable.team_id, teamId));

    return credentials.map((cred: any) => this.formatCredentialResponse(cred));
  }

  /**
   * Get all cloud credentials for a team (basic details for team members)
   */
  async getTeamCredentialsBasic(teamId: string): Promise<CloudCredentialBasicResponse[]> {
    const { db, schema } = this.getDbAndSchema();
    const credentialsTable = schema.teamCloudCredentials;
    const authUserTable = schema.authUser;
    
    const credentials = await (db as any)
      .select({
        id: credentialsTable.id,
        team_id: credentialsTable.team_id,
        provider_id: credentialsTable.provider_id,
        name: credentialsTable.name,
        comment: credentialsTable.comment,
        credentials: credentialsTable.credentials,
        created_by: credentialsTable.created_by,
        created_at: credentialsTable.created_at,
        updated_at: credentialsTable.updated_at,
        // User information
        user_username: authUserTable.username,
        user_email: authUserTable.email,
      })
      .from(credentialsTable)
      .leftJoin(authUserTable, eq(credentialsTable.created_by, authUserTable.id))
      .where(eq(credentialsTable.team_id, teamId));

    return credentials.map((cred: any) => this.formatCredentialBasicResponse(cred));
  }

  /**
   * Get all cloud credentials for a team (global admin view - metadata but no values)
   */
  async getTeamCredentialsGlobalAdmin(teamId: string): Promise<CloudCredentialResponse[]> {
    const { db, schema } = this.getDbAndSchema();
    const credentialsTable = schema.teamCloudCredentials;
    
    const credentials = await (db as any)
      .select()
      .from(credentialsTable)
      .where(eq(credentialsTable.team_id, teamId));

    return credentials.map((cred: any) => this.formatCredentialGlobalAdminResponse(cred));
  }

  /**
   * Get a specific credential by ID (full details for admins)
   */
  async getCredentialById(credentialId: string, teamId: string): Promise<CloudCredentialResponse | null> {
    const { db, schema } = this.getDbAndSchema();
    const credentialsTable = schema.teamCloudCredentials;
    const authUserTable = schema.authUser;
    
    const credentials = await (db as any)
      .select({
        id: credentialsTable.id,
        team_id: credentialsTable.team_id,
        provider_id: credentialsTable.provider_id,
        name: credentialsTable.name,
        comment: credentialsTable.comment,
        credentials: credentialsTable.credentials,
        created_by: credentialsTable.created_by,
        created_at: credentialsTable.created_at,
        updated_at: credentialsTable.updated_at,
        // User information
        user_username: authUserTable.username,
        user_email: authUserTable.email,
      })
      .from(credentialsTable)
      .leftJoin(authUserTable, eq(credentialsTable.created_by, authUserTable.id))
      .where(and(
        eq(credentialsTable.id, credentialId),
        eq(credentialsTable.team_id, teamId)
      ))
      .limit(1);

    if (credentials.length === 0) return null;

    return this.formatCredentialResponse(credentials[0]);
  }

  /**
   * Get a specific credential by ID (basic details for team members)
   */
  async getCredentialByIdBasic(credentialId: string, teamId: string): Promise<CloudCredentialBasicResponse | null> {
    const { db, schema } = this.getDbAndSchema();
    const credentialsTable = schema.teamCloudCredentials;
    
    const credentials = await (db as any)
      .select()
      .from(credentialsTable)
      .where(and(
        eq(credentialsTable.id, credentialId),
        eq(credentialsTable.team_id, teamId)
      ))
      .limit(1);

    if (credentials.length === 0) return null;

    return this.formatCredentialBasicResponse(credentials[0]);
  }

  /**
   * Get a specific credential by ID (global admin view - metadata but no values)
   */
  async getCredentialByIdGlobalAdmin(credentialId: string, teamId: string): Promise<CloudCredentialResponse | null> {
    const { db, schema } = this.getDbAndSchema();
    const credentialsTable = schema.teamCloudCredentials;
    
    const credentials = await (db as any)
      .select()
      .from(credentialsTable)
      .where(and(
        eq(credentialsTable.id, credentialId),
        eq(credentialsTable.team_id, teamId)
      ))
      .limit(1);

    if (credentials.length === 0) return null;

    return this.formatCredentialGlobalAdminResponse(credentials[0]);
  }

  /**
   * Create new cloud credentials
   */
  async createCredentials(
    teamId: string, 
    userId: string, 
    input: CreateCloudCredentialRequest
  ): Promise<CloudCredentialResponse> {
    const { db, schema } = this.getDbAndSchema();
    const credentialsTable = schema.teamCloudCredentials;

    // Validate provider exists
    const provider = getCloudProvider(input.providerId);
    if (!provider) {
      throw new Error('Invalid provider ID');
    }

    // Validate credential data
    const validation = validateCredentialData(input.providerId, input.credentials);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check for duplicate name within team/provider
    const existingCredentials = await (db as any)
      .select()
      .from(credentialsTable)
      .where(and(
        eq(credentialsTable.team_id, teamId),
        eq(credentialsTable.provider_id, input.providerId),
        eq(credentialsTable.name, input.name)
      ))
      .limit(1);

    if (existingCredentials.length > 0) {
      throw new Error('A credential set with this name already exists for this provider');
    }

    // Encrypt credentials
    const encryptedCredentials = await this.encryptCredentials(input.providerId, input.credentials);
    
    const credentialData = {
      id: generateId(15),
      team_id: teamId,
      provider_id: input.providerId,
      name: input.name.trim(),
      comment: input.comment?.trim() || null,
      credentials: JSON.stringify(encryptedCredentials),
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await (db as any).insert(credentialsTable).values(credentialData);

    return this.formatCredentialResponse(credentialData);
  }

  /**
   * Update existing cloud credentials
   */
  async updateCredentials(
    credentialId: string,
    teamId: string,
    input: UpdateCloudCredentialRequest
  ): Promise<CloudCredentialResponse | null> {
    const { db, schema } = this.getDbAndSchema();
    const credentialsTable = schema.teamCloudCredentials;

    // Get existing credential
    const existing = await this.getCredentialById(credentialId, teamId);
    if (!existing) return null;

    const updateData: any = {
      updated_at: new Date(),
    };

    // Update name if provided
    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (trimmedName !== existing.name) {
        // Check for duplicate name
        const duplicateCheck = await (db as any)
          .select()
          .from(credentialsTable)
          .where(and(
            eq(credentialsTable.team_id, teamId),
            eq(credentialsTable.provider_id, existing.providerId),
            eq(credentialsTable.name, trimmedName)
          ))
          .limit(1);

        if (duplicateCheck.length > 0) {
          throw new Error('A credential set with this name already exists for this provider');
        }
      }
      updateData.name = trimmedName;
    }

    // Update comment if provided
    if (input.comment !== undefined) {
      updateData.comment = input.comment.trim() || null;
    }

    // Update credentials if provided
    if (input.credentials !== undefined) {
      // Validate new credential data (partial update validation)
      const validation = validateCredentialDataForUpdate(existing.providerId, input.credentials);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Get existing credentials to merge with updates
      const existingDecrypted = await this.getDecryptedCredentials(credentialId, teamId);
      if (!existingDecrypted) {
        throw new Error('Failed to retrieve existing credentials for update');
      }

      // Merge existing credentials with updates
      const mergedCredentials = { ...existingDecrypted, ...input.credentials };

      // Encrypt merged credentials
      const encryptedCredentials = await this.encryptCredentials(existing.providerId, mergedCredentials);
      updateData.credentials = JSON.stringify(encryptedCredentials);
    }

    await (db as any)
      .update(credentialsTable)
      .set(updateData)
      .where(and(
        eq(credentialsTable.id, credentialId),
        eq(credentialsTable.team_id, teamId)
      ));

    return this.getCredentialById(credentialId, teamId);
  }

  /**
   * Delete cloud credentials
   */
  async deleteCredentials(credentialId: string, teamId: string): Promise<boolean> {
    const { db, schema } = this.getDbAndSchema();
    const credentialsTable = schema.teamCloudCredentials;

    // First check if the credential exists
    const existing = await (db as any)
      .select({ id: credentialsTable.id })
      .from(credentialsTable)
      .where(and(
        eq(credentialsTable.id, credentialId),
        eq(credentialsTable.team_id, teamId)
      ))
      .limit(1);

    if (existing.length === 0) {
      return false;
    }

    // Delete the credential
    await (db as any)
      .delete(credentialsTable)
      .where(and(
        eq(credentialsTable.id, credentialId),
        eq(credentialsTable.team_id, teamId)
      ));

    return true;
  }

  /**
   * Search team credentials by name or comment
   */
  async searchTeamCredentials(teamId: string, query: string, limit: number = 50): Promise<CloudCredentialBasicResponse[]> {
    const { db, schema } = this.getDbAndSchema();
    const credentialsTable = schema.teamCloudCredentials;
    
    const searchPattern = `%${query}%`;
    
    const credentials = await (db as any)
      .select()
      .from(credentialsTable)
      .where(and(
        eq(credentialsTable.team_id, teamId),
        or(
          like(credentialsTable.name, searchPattern),
          like(credentialsTable.comment, searchPattern)
        )
      ))
      .limit(limit);

    return credentials.map((cred: any) => this.formatCredentialBasicResponse(cred));
  }

  /**
   * Get decrypted credentials for deployment use (internal only)
   */
  async getDecryptedCredentials(credentialId: string, teamId: string): Promise<Record<string, string> | null> {
    const { db, schema } = this.getDbAndSchema();
    const credentialsTable = schema.teamCloudCredentials;
    
    const credentials = await (db as any)
      .select()
      .from(credentialsTable)
      .where(and(
        eq(credentialsTable.id, credentialId),
        eq(credentialsTable.team_id, teamId)
      ))
      .limit(1);

    if (credentials.length === 0) return null;

    const cred = credentials[0];
    const storedCredentials: StoredCredentials = JSON.parse(cred.credentials);
    const decryptedCredentials: Record<string, string> = {};

    for (const [key, data] of Object.entries(storedCredentials)) {
      decryptedCredentials[key] = await decrypt(data.value);
    }

    return decryptedCredentials;
  }

  /**
   * Encrypt credential fields based on provider configuration
   */
  private async encryptCredentials(providerId: string, credentials: Record<string, string>): Promise<StoredCredentials> {
    const provider = getCloudProvider(providerId);
    if (!provider) {
      throw new Error('Invalid provider ID');
    }

    const encrypted: StoredCredentials = {};
    const now = new Date().toISOString();

    for (const field of provider.fields) {
      const value = credentials[field.key];
      if (value !== undefined) {
        encrypted[field.key] = {
          value: await encrypt(value),
          secret: field.secret,
          updatedAt: now,
        };
      }
    }

    return encrypted;
  }

  /**
   * Format credential data for API response (team admin view - shows non-secret values)
   */
  private formatCredentialResponse(credentialData: any): CloudCredentialResponse {
    const provider = getCloudProvider(credentialData.provider_id);
    if (!provider) {
      throw new Error('Invalid provider ID in stored credential');
    }

    const storedCredentials: StoredCredentials = JSON.parse(credentialData.credentials);
    const fields: Record<string, any> = {};

    for (const field of provider.fields) {
      const storedField = storedCredentials[field.key];
      if (storedField) {
        fields[field.key] = {
          hasValue: true,
          secret: field.secret,
          // Team admins can see non-secret field values, but NEVER secret values
          ...(field.secret ? {} : { value: 'PLACEHOLDER_VALUE' })
        };
      } else {
        fields[field.key] = {
          hasValue: false,
          secret: field.secret,
        };
      }
    }

    // Format createdBy as user object if user info is available
    const createdBy = credentialData.user_username && credentialData.user_email 
      ? {
          id: credentialData.created_by,
          username: credentialData.user_username,
          email: credentialData.user_email,
        }
      : credentialData.created_by; // Fallback to ID if user info not available

    return {
      id: credentialData.id,
      teamId: credentialData.team_id,
      providerId: credentialData.provider_id,
      name: credentialData.name,
      comment: credentialData.comment,
      provider: {
        id: provider.id,
        name: provider.name,
        description: provider.description,
      },
      fields,
      createdBy,
      createdAt: credentialData.created_at.toISOString(),
      updatedAt: credentialData.updated_at.toISOString(),
    };
  }

  /**
   * Format credential data for basic API response (no field information)
   */
  private formatCredentialBasicResponse(credentialData: any): CloudCredentialBasicResponse {
    const provider = getCloudProvider(credentialData.provider_id);
    if (!provider) {
      throw new Error('Invalid provider ID in stored credential');
    }

    // Format createdBy as user object if user info is available
    const createdBy = credentialData.user_username && credentialData.user_email 
      ? {
          id: credentialData.created_by,
          username: credentialData.user_username,
          email: credentialData.user_email,
        }
      : credentialData.created_by; // Fallback to ID if user info not available

    return {
      id: credentialData.id,
      teamId: credentialData.team_id,
      providerId: credentialData.provider_id,
      name: credentialData.name,
      comment: credentialData.comment,
      provider: {
        id: provider.id,
        name: provider.name,
        description: provider.description,
      },
      createdBy,
      createdAt: credentialData.created_at.toISOString(),
      updatedAt: credentialData.updated_at.toISOString(),
    };
  }

  /**
   * Format credential data for global admin API response (shows field metadata but no values)
   */
  private formatCredentialGlobalAdminResponse(credentialData: any): CloudCredentialResponse {
    const provider = getCloudProvider(credentialData.provider_id);
    if (!provider) {
      throw new Error('Invalid provider ID in stored credential');
    }

    const storedCredentials: StoredCredentials = JSON.parse(credentialData.credentials);
    const fields: Record<string, any> = {};

    for (const field of provider.fields) {
      const storedField = storedCredentials[field.key];
      if (storedField) {
        fields[field.key] = {
          hasValue: true,
          secret: field.secret,
          // Global admins see no values, only metadata
        };
      } else {
        fields[field.key] = {
          hasValue: false,
          secret: field.secret,
        };
      }
    }

    return {
      id: credentialData.id,
      teamId: credentialData.team_id,
      providerId: credentialData.provider_id,
      name: credentialData.name,
      comment: credentialData.comment,
      provider: {
        id: provider.id,
        name: provider.name,
        description: provider.description,
      },
      fields,
      createdBy: credentialData.created_by,
      createdAt: credentialData.created_at.toISOString(),
      updatedAt: credentialData.updated_at.toISOString(),
    };
  }
}
