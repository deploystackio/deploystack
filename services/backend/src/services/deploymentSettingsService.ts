import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AnyDatabase } from '../db';
import { getSchema } from '../db';

interface DeploymentSettings {
  id: string;
  serverId: string;
  autoDeployEnabled: boolean;
  webhookId: string | null;
  webhookSecret: string | null;
  createdAt: string;
  updatedAt: string;
}

export class DeploymentSettingsService {
  private readonly db: AnyDatabase;
  private readonly deploymentSettings: ReturnType<typeof getSchema>['deploymentSettings'];

  constructor(db: AnyDatabase) {
    this.db = db;
    const schema = getSchema();
    this.deploymentSettings = schema.deploymentSettings;
  }

  /**
   * Create deployment settings for server
   */
  async createSettings(serverId: string): Promise<string> {
    const id = `settings-${nanoid()}`;

    await this.db.insert(this.deploymentSettings).values({
      id,
      server_id: serverId,
      auto_deploy_enabled: true,
      webhook_id: null,
      webhook_secret: null,
      created_at: new Date(),
      updated_at: new Date()
    });

    return id;
  }

  /**
   * Get settings for server
   */
  async getSettings(serverId: string): Promise<DeploymentSettings | null> {
    const results = await this.db
      .select()
      .from(this.deploymentSettings)
      .where(eq(this.deploymentSettings.server_id, serverId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const settings = results[0];
    return {
      id: settings.id,
      serverId: settings.server_id,
      autoDeployEnabled: settings.auto_deploy_enabled,
      webhookId: settings.webhook_id,
      webhookSecret: settings.webhook_secret,
      createdAt: settings.created_at.toISOString(),
      updatedAt: settings.updated_at.toISOString()
    };
  }

  /**
   * Update auto-deploy setting
   */
  async updateAutoDeployEnabled(serverId: string, enabled: boolean): Promise<void> {
    await this.db
      .update(this.deploymentSettings)
      .set({
        auto_deploy_enabled: enabled,
        updated_at: new Date()
      })
      .where(eq(this.deploymentSettings.server_id, serverId));
  }

  /**
   * Store webhook registration details
   */
  async storeWebhookDetails(
    serverId: string,
    webhookId: string,
    webhookSecret: string
  ): Promise<void> {
    await this.db
      .update(this.deploymentSettings)
      .set({
        webhook_id: webhookId,
        webhook_secret: webhookSecret,
        updated_at: new Date()
      })
      .where(eq(this.deploymentSettings.server_id, serverId));
  }
}
