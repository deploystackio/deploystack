import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AnyDatabase } from '../db';
import { getSchema } from '../db';
import { encryptDeploymentToken, decryptDeploymentToken } from '../lib/deployment/encryption';

interface StoreCredentialParams {
  teamId: string;
  source: string;
  accessToken: string;
  refreshToken?: string;
  scopes?: string[];
  expiresAt?: Date;
}

interface Credential {
  id: string;
  teamId: string;
  source: string;
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: Date | null;
}

export class DeploymentCredentialService {
  private readonly db: AnyDatabase;
  private readonly deploymentCredentials: ReturnType<typeof getSchema>['deploymentCredentials'];

  constructor(db: AnyDatabase) {
    this.db = db;
    const schema = getSchema();
    this.deploymentCredentials = schema.deploymentCredentials;
  }

  /**
   * Store team's GitHub OAuth token (encrypted)
   */
  async storeCredential(params: StoreCredentialParams): Promise<string> {
    // Encrypt tokens
    const accessTokenEncrypted = encryptDeploymentToken(params.accessToken);
    const refreshTokenEncrypted = params.refreshToken
      ? encryptDeploymentToken(params.refreshToken)
      : null;

    // Check if credential exists
    const existing = await this.db
      .select()
      .from(this.deploymentCredentials)
      .where(
        and(
          eq(this.deploymentCredentials.team_id, params.teamId),
          eq(this.deploymentCredentials.source, params.source)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing credential
      await this.db
        .update(this.deploymentCredentials)
        .set({
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          scopes: params.scopes || [],
          expires_at: params.expiresAt || null,
          updated_at: new Date()
        })
        .where(eq(this.deploymentCredentials.id, existing[0].id));

      return existing[0].id;
    } else {
      // Insert new credential
      const id = `cred-${nanoid()}`;
      await this.db.insert(this.deploymentCredentials).values({
        id,
        team_id: params.teamId,
        source: params.source,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        scopes: params.scopes || [],
        expires_at: params.expiresAt || null,
        created_at: new Date(),
        updated_at: new Date()
      });

      return id;
    }
  }

  /**
   * Get team's GitHub credential (decrypted)
   */
  async getCredential(teamId: string, source: string): Promise<Credential | null> {
    const results = await this.db
      .select()
      .from(this.deploymentCredentials)
      .where(
        and(
          eq(this.deploymentCredentials.team_id, teamId),
          eq(this.deploymentCredentials.source, source)
        )
      )
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const cred = results[0];

    // Check if credential is OAuth type and has access token
    if (!cred.access_token_encrypted) {
      return null;
    }

    return {
      id: cred.id,
      teamId: cred.team_id,
      source: cred.source,
      accessToken: decryptDeploymentToken(cred.access_token_encrypted),
      refreshToken: cred.refresh_token_encrypted
        ? decryptDeploymentToken(cred.refresh_token_encrypted)
        : null,
      scopes: cred.scopes || [],
      expiresAt: cred.expires_at ? new Date(cred.expires_at) : null
    };
  }

  /**
   * Delete team's GitHub credential
   */
  async deleteCredential(teamId: string, source: string): Promise<boolean> {
    const result = await this.db
      .delete(this.deploymentCredentials)
      .where(
        and(
          eq(this.deploymentCredentials.team_id, teamId),
          eq(this.deploymentCredentials.source, source)
        )
      );

    return (result.rowCount || 0) > 0;
  }

  /**
   * Check if team has GitHub credential
   */
  async hasCredential(teamId: string, source: string): Promise<boolean> {
    const cred = await this.getCredential(teamId, source);
    return cred !== null;
  }

  // ===== GitHub App Installation Methods (New) =====

  /**
   * Store GitHub App installation ID for a team
   */
  async storeInstallation(params: {
    teamId: string;
    source: string;
    installationId: string;
    accountLogin?: string;
    accountId?: string;
  }): Promise<string> {
    // Check if credential exists
    const existing = await this.db
      .select()
      .from(this.deploymentCredentials)
      .where(
        and(
          eq(this.deploymentCredentials.team_id, params.teamId),
          eq(this.deploymentCredentials.source, params.source)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing credential to installation type
      await this.db
        .update(this.deploymentCredentials)
        .set({
          auth_type: 'installation',
          installation_id: params.installationId,
          account_login: params.accountLogin || null,
          account_id: params.accountId || null,
          updated_at: new Date()
        })
        .where(eq(this.deploymentCredentials.id, existing[0].id));

      return existing[0].id;
    } else {
      // Insert new installation credential
      const id = `cred-${nanoid()}`;
      await this.db.insert(this.deploymentCredentials).values({
        id,
        team_id: params.teamId,
        source: params.source,
        auth_type: 'installation',
        installation_id: params.installationId,
        account_login: params.accountLogin || null,
        account_id: params.accountId || null,
        access_token_encrypted: null,
        created_at: new Date(),
        updated_at: new Date()
      });

      return id;
    }
  }

  /**
   * Get GitHub App installation for a team
   */
  async getInstallation(teamId: string, source: string): Promise<{
    id: string;
    teamId: string;
    source: string;
    installationId: string;
    accountLogin: string | null;
    accountId: string | null;
  } | null> {
    const results = await this.db
      .select()
      .from(this.deploymentCredentials)
      .where(
        and(
          eq(this.deploymentCredentials.team_id, teamId),
          eq(this.deploymentCredentials.source, source),
          eq(this.deploymentCredentials.auth_type, 'installation')
        )
      )
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const inst = results[0];

    if (!inst.installation_id) {
      return null;
    }

    return {
      id: inst.id,
      teamId: inst.team_id,
      source: inst.source,
      installationId: inst.installation_id,
      accountLogin: inst.account_login,
      accountId: inst.account_id
    };
  }

  /**
   * Check if team has GitHub App installation
   */
  async hasInstallation(teamId: string, source: string): Promise<boolean> {
    const installation = await this.getInstallation(teamId, source);
    return installation !== null;
  }

  /**
   * Delete GitHub App installation
   */
  async deleteInstallation(teamId: string, source: string): Promise<boolean> {
    const result = await this.db
      .delete(this.deploymentCredentials)
      .where(
        and(
          eq(this.deploymentCredentials.team_id, teamId),
          eq(this.deploymentCredentials.source, source),
          eq(this.deploymentCredentials.auth_type, 'installation')
        )
      );

    return (result.rowCount || 0) > 0;
  }
}
