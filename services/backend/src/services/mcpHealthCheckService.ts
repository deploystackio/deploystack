import { eq, and, inArray, sql, or, isNull, lt } from 'drizzle-orm';
import { getSchema } from '../db/index';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { SatelliteCommandService } from './satelliteCommandService';

export type HealthStatus = 'unknown' | 'online' | 'offline';

export interface HealthCheckResult {
  status: HealthStatus;
  error?: string;
  responseTimeMs?: number;
}

export interface TemplateWithInstallations {
  id: string;
  name: string;
  transport_type: 'stdio' | 'http' | 'sse';
  remotes: string | null;
  health_status: string;
}

export interface CredentialValidationResult {
  valid: boolean;
  error?: string;
  needsReauth?: boolean;
}

export interface InstallationForCredentialCheck {
  id: string;
  team_id: string;
  server_id: string;
  installation_name: string;
  requires_oauth: boolean;
  transport_type: 'stdio' | 'http' | 'sse';
}

/**
 * MCP Health Check Service
 *
 * Implements cumulative health checks at the template level (not per-installation)
 * to avoid hammering remote servers with redundant checks.
 *
 * Logic:
 * 1. Find all templates with active installations that use HTTP/SSE transport
 * 2. Check template URL health (HTTP HEAD/GET with timeout)
 * 3. Update template health_status
 * 4. Distribute health status changes to affected installations
 */
export class McpHealthCheckService {
  private readonly mcpServers: ReturnType<typeof getSchema>['mcpServers'];
  private readonly mcpServerInstallations: ReturnType<typeof getSchema>['mcpServerInstallations'];
  private readonly mcpServerInstances: ReturnType<typeof getSchema>['mcpServerInstances'];
  private readonly mcpOauthTokens: ReturnType<typeof getSchema>['mcpOauthTokens'];

  private readonly HEALTH_CHECK_TIMEOUT_MS = 10000; // 10 seconds
  private readonly CREDENTIAL_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  private readonly CREDENTIAL_CHECK_BATCH_SIZE = 50; // Process in batches

  private satelliteCommandService?: SatelliteCommandService;

  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger
  ) {
    const schema = getSchema();
    this.mcpServers = schema.mcpServers;
    this.mcpServerInstallations = schema.mcpServerInstallations;
    this.mcpServerInstances = schema.mcpServerInstances;
    this.mcpOauthTokens = schema.mcpOauthTokens;
  }

  /**
   * Set satellite command service (for API key validation via satellite)
   */
  setSatelliteCommandService(service: SatelliteCommandService): void {
    this.satelliteCommandService = service;
  }

  /**
   * Check a single template's health (HTTP ping)
   */
  async checkTemplateHealth(templateId: string): Promise<HealthCheckResult> {
    const template = await this.db
      .select({
        id: this.mcpServers.id,
        name: this.mcpServers.name,
        transport_type: this.mcpServers.transport_type,
        remotes: this.mcpServers.remotes
      })
      .from(this.mcpServers)
      .where(eq(this.mcpServers.id, templateId))
      .limit(1);

    if (template.length === 0) {
      return {
        status: 'unknown',
        error: 'Template not found'
      };
    }

    const server = template[0];

    // Only check HTTP/SSE servers
    if (server.transport_type === 'stdio') {
      return {
        status: 'unknown',
        error: 'stdio servers do not have URLs to check'
      };
    }

    // Parse remotes to get URL
    let url: string | undefined;
    try {
      const remotes = server.remotes ? JSON.parse(server.remotes) : [];
      if (remotes.length > 0 && remotes[0].url) {
        url = remotes[0].url;
      }
    } catch {
      return {
        status: 'offline',
        error: 'Failed to parse remotes configuration'
      };
    }

    if (!url) {
      return {
        status: 'unknown',
        error: 'No URL configured for HTTP/SSE server'
      };
    }

    // Perform health check
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.HEALTH_CHECK_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseTimeMs = Date.now() - startTime;

      // Any response means server is reachable (even 4xx/5xx)
      this.logger.debug({
        operation: 'health_check_success',
        templateId,
        templateName: server.name,
        url,
        statusCode: response.status,
        responseTimeMs
      }, `Health check passed for ${server.name}`);

      return {
        status: 'online',
        responseTimeMs
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.debug({
        operation: 'health_check_failed',
        templateId,
        templateName: server.name,
        url,
        error: errorMessage,
        responseTimeMs
      }, `Health check failed for ${server.name}: ${errorMessage}`);

      return {
        status: 'offline',
        error: errorMessage,
        responseTimeMs
      };
    }
  }

  /**
   * Get all templates that have at least one active installation
   * Only includes HTTP/SSE templates with URLs
   */
  async getTemplatesWithInstallations(): Promise<TemplateWithInstallations[]> {
    // Query distinct templates that have at least one installation
    // Only HTTP/SSE transport types with remotes configured
    const results = await this.db
      .selectDistinctOn([this.mcpServers.id], {
        id: this.mcpServers.id,
        name: this.mcpServers.name,
        transport_type: this.mcpServers.transport_type,
        remotes: this.mcpServers.remotes,
        health_status: this.mcpServers.health_status
      })
      .from(this.mcpServers)
      .innerJoin(
        this.mcpServerInstallations,
        eq(this.mcpServerInstallations.server_id, this.mcpServers.id)
      )
      .where(
        and(
          inArray(this.mcpServers.transport_type, ['http', 'sse']),
          sql`${this.mcpServers.remotes} IS NOT NULL`
        )
      );

    return results as TemplateWithInstallations[];
  }

  /**
   * Distribute health status to all user instances using this template
   *
   * Logic:
   * - If template is offline, mark ALL 'online' instances as 'offline'
   * - If template is online, mark ALL 'offline' instances as 'connecting'
   *   (Use 'connecting' for recovery to trigger satellite reconnection)
   * - Updates ALL user instances (including dormant ones) since they share the same remote URL
   */
  async distributeHealthStatus(
    templateId: string,
    status: HealthStatus,
    error?: string
  ): Promise<{ updatedCount: number; recoveredInstallations: Array<{ id: string; team_id: string }> }> {
    const now = new Date();

    // Update the template itself first
    await this.db
      .update(this.mcpServers)
      .set({
        health_status: status,
        last_health_check_at: now,
        health_check_error: status === 'offline' ? error : null,
        updated_at: now
      })
      .where(eq(this.mcpServers.id, templateId));

    // Get all installations for this template
    const installations = await this.db
      .select({
        id: this.mcpServerInstallations.id,
        team_id: this.mcpServerInstallations.team_id
      })
      .from(this.mcpServerInstallations)
      .where(eq(this.mcpServerInstallations.server_id, templateId));

    if (installations.length === 0) {
      this.logger.debug({
        operation: 'distribute_health_status',
        templateId,
        status
      }, 'No installations found for template');
      return { updatedCount: 0, recoveredInstallations: [] };
    }

    const installationIds = installations.map(i => i.id);
    let updatedCount = 0;
    const recoveredInstallations: Array<{ id: string; team_id: string }> = [];

    if (status === 'offline') {
      // If template is offline, mark ALL 'online' instances as 'offline'
      const result = await this.db
        .update(this.mcpServerInstances)
        .set({
          status: 'offline',
          status_message: error || 'MCP server is unreachable',
          status_updated_at: now,
          last_health_check_at: now
        })
        .where(
          and(
            inArray(this.mcpServerInstances.installation_id, installationIds),
            eq(this.mcpServerInstances.status, 'online')
          )
        );

      updatedCount = result.rowCount || 0;
    } else if (status === 'online') {
      // Get installations with offline instances (for recovery notifications)
      const installationsWithOfflineInstances = await this.db
        .selectDistinctOn([this.mcpServerInstances.installation_id], {
          installation_id: this.mcpServerInstances.installation_id
        })
        .from(this.mcpServerInstances)
        .where(
          and(
            inArray(this.mcpServerInstances.installation_id, installationIds),
            eq(this.mcpServerInstances.status, 'offline')
          )
        );

      // Mark ALL 'offline' instances as 'connecting'
      // Satellite will update to 'online' after successful tool rediscovery
      if (installationsWithOfflineInstances.length > 0) {
        const result = await this.db
          .update(this.mcpServerInstances)
          .set({
            status: 'connecting',
            status_message: 'Server recovered, waiting for satellite to reconnect',
            status_updated_at: now,
            last_health_check_at: now
          })
          .where(
            and(
              inArray(this.mcpServerInstances.installation_id, installationIds),
              eq(this.mcpServerInstances.status, 'offline')
            )
          );

        updatedCount = result.rowCount || 0;

        // Map installation IDs back to installation+team info for recovery notifications
        const recoveredInstallationIds = installationsWithOfflineInstances.map(i => i.installation_id);
        recoveredInstallations.push(
          ...installations.filter(inst => recoveredInstallationIds.includes(inst.id))
        );
      }
    }

    this.logger.debug({
      operation: 'distribute_health_status',
      templateId,
      status,
      updatedCount,
      recoveredCount: recoveredInstallations.length,
      installationCount: installations.length
    }, `Distributed ${status} status to ${updatedCount} instances across ${installations.length} installations (${recoveredInstallations.length} recovered)`);

    return { updatedCount, recoveredInstallations };
  }

  /**
   * Run health checks for all active templates
   */
  async runHealthChecks(): Promise<{
    templatesChecked: number;
    online: number;
    offline: number;
    installationsUpdated: number;
    installationsRecovered: number;
  }> {
    this.logger.info({
      operation: 'health_check_run_started'
    }, 'Starting cumulative health check run');

    const templates = await this.getTemplatesWithInstallations();

    if (templates.length === 0) {
      this.logger.info({
        operation: 'health_check_run_complete',
        templatesChecked: 0
      }, 'No templates with active installations to check');

      return {
        templatesChecked: 0,
        online: 0,
        offline: 0,
        installationsUpdated: 0,
        installationsRecovered: 0
      };
    }

    let online = 0;
    let offline = 0;
    let installationsUpdated = 0;
    let installationsRecovered = 0;

    // Check each template sequentially to avoid overwhelming servers
    for (const template of templates) {
      const result = await this.checkTemplateHealth(template.id);

      if (result.status === 'online') {
        online++;
      } else if (result.status === 'offline') {
        offline++;
      }

      // Distribute health status to installations
      const distribution = await this.distributeHealthStatus(
        template.id,
        result.status,
        result.error
      );

      installationsUpdated += distribution.updatedCount;

      // Handle recovered installations - trigger satellite rediscovery
      if (distribution.recoveredInstallations.length > 0) {
        installationsRecovered += distribution.recoveredInstallations.length;
        await this.handleRecovery(distribution.recoveredInstallations);
      }

      // Log status changes
      if (template.health_status !== result.status) {
        this.logger.info({
          operation: 'health_status_changed',
          templateId: template.id,
          templateName: template.name,
          previousStatus: template.health_status,
          newStatus: result.status,
          error: result.error,
          responseTimeMs: result.responseTimeMs,
          recoveredInstallations: distribution.recoveredInstallations.length
        }, `Template ${template.name} health status changed: ${template.health_status} -> ${result.status}`);
      }
    }

    this.logger.info({
      operation: 'health_check_run_complete',
      templatesChecked: templates.length,
      online,
      offline,
      installationsUpdated,
      installationsRecovered
    }, `Health check complete: ${templates.length} templates (${online} online, ${offline} offline), ${installationsUpdated} installations updated, ${installationsRecovered} recovered`);

    return {
      templatesChecked: templates.length,
      online,
      offline,
      installationsUpdated,
      installationsRecovered
    };
  }

  // ==================== Auto-Recovery ====================

  /**
   * Handle recovered installations by triggering satellite rediscovery
   * Called when template health check detects server is back online
   */
  private async handleRecovery(
    recoveredInstallations: Array<{ id: string; team_id: string }>
  ): Promise<void> {
    if (!this.satelliteCommandService) {
      this.logger.warn({
        operation: 'handle_recovery_skipped',
        installationCount: recoveredInstallations.length,
        reason: 'no_satellite_command_service'
      }, 'Cannot trigger recovery - SatelliteCommandService not set');
      return;
    }

    this.logger.info({
      operation: 'handle_recovery_started',
      installationCount: recoveredInstallations.length
    }, `Triggering rediscovery for ${recoveredInstallations.length} recovered installations`);

    // Send recovery notification for each installation
    for (const installation of recoveredInstallations) {
      try {
        await this.satelliteCommandService.notifyMcpRecovery(
          installation.id,
          installation.team_id
        );

        this.logger.debug({
          operation: 'recovery_notification_sent',
          installationId: installation.id,
          teamId: installation.team_id
        }, `Recovery notification sent for installation ${installation.id}`);
      } catch (error) {
        this.logger.error({
          operation: 'recovery_notification_failed',
          installationId: installation.id,
          teamId: installation.team_id,
          error: error instanceof Error ? error.message : String(error)
        }, `Failed to send recovery notification for ${installation.id}`);
        // Continue with other installations even if one fails
      }
    }

    this.logger.info({
      operation: 'handle_recovery_complete',
      installationCount: recoveredInstallations.length
    }, `Recovery notifications sent for ${recoveredInstallations.length} installations`);
  }

  // ==================== Credential Validation ====================

  /**
   * Get installations that need credential validation
   * Returns installations that have at least one 'online' instance
   * and haven't been checked recently
   */
  async getInstallationsNeedingCredentialCheck(): Promise<InstallationForCredentialCheck[]> {
    const threshold = new Date(Date.now() - this.CREDENTIAL_CHECK_INTERVAL_MS);

    // Get distinct installations with at least one online instance
    // that need credential checking (based on instances' last_credential_check_at)
    const results = await this.db
      .selectDistinctOn([this.mcpServerInstallations.id], {
        id: this.mcpServerInstallations.id,
        team_id: this.mcpServerInstallations.team_id,
        server_id: this.mcpServerInstallations.server_id,
        installation_name: this.mcpServerInstallations.installation_name,
        requires_oauth: this.mcpServers.requires_oauth,
        transport_type: this.mcpServers.transport_type
      })
      .from(this.mcpServerInstances)
      .innerJoin(
        this.mcpServerInstallations,
        eq(this.mcpServerInstances.installation_id, this.mcpServerInstallations.id)
      )
      .innerJoin(
        this.mcpServers,
        eq(this.mcpServerInstallations.server_id, this.mcpServers.id)
      )
      .where(
        and(
          // Only check instances that are 'online' (don't check already-failed ones)
          eq(this.mcpServerInstances.status, 'online'),
          // Need credential check if never checked or > 15 min ago
          or(
            isNull(this.mcpServerInstances.last_credential_check_at),
            lt(this.mcpServerInstances.last_credential_check_at, threshold)
          )
        )
      )
      .limit(this.CREDENTIAL_CHECK_BATCH_SIZE);

    return results as InstallationForCredentialCheck[];
  }

  /**
   * Validate OAuth credentials for an installation
   * Checks if token exists, is not expired, and can be refreshed if needed
   */
  async validateOAuthCredentials(installationId: string): Promise<CredentialValidationResult> {
    // Get token for this installation
    const tokens = await this.db
      .select()
      .from(this.mcpOauthTokens)
      .where(eq(this.mcpOauthTokens.installation_id, installationId))
      .limit(1);

    if (tokens.length === 0) {
      // No OAuth token = needs authentication
      return {
        valid: false,
        error: 'No OAuth token found',
        needsReauth: true
      };
    }

    const token = tokens[0];
    const now = new Date();

    // Check if token has expiry info and is expired
    if (token.expires_at) {
      const expiresAt = new Date(token.expires_at);

      if (expiresAt <= now) {
        // Token is expired
        if (!token.refresh_token) {
          // No refresh token = needs reauth
          return {
            valid: false,
            error: 'OAuth token expired and no refresh token available',
            needsReauth: true
          };
        }

        // Has refresh token - token refresh job should handle this
        // For now, mark as needing reauth since token is already expired
        this.logger.debug({
          operation: 'oauth_credential_check',
          installationId,
          tokenId: token.id,
          expiresAt: token.expires_at
        }, 'OAuth token expired but has refresh token - refresh job should handle');

        return {
          valid: false,
          error: 'OAuth token expired - awaiting refresh',
          needsReauth: false // refresh job will handle it
        };
      }
    }

    // Token exists and is not expired
    return {
      valid: true
    };
  }

  /**
   * Request satellite to validate API key credentials for an installation
   * Creates a health_check command with credential_validation type
   */
  async requestCredentialValidation(installationId: string, teamId: string): Promise<void> {
    if (!this.satelliteCommandService) {
      this.logger.warn({
        operation: 'credential_validation_request_skipped',
        installationId,
        reason: 'no_satellite_command_service'
      }, 'Cannot request credential validation - SatelliteCommandService not set');
      return;
    }

    await this.satelliteCommandService.createCommandForAllGlobalSatellites({
      commandType: 'health_check',
      priority: 'normal',
      payload: {
        check_type: 'credential_validation',
        installation_id: installationId
      },
      targetTeamId: teamId,
      expiresInMinutes: 5
    });

    this.logger.debug({
      operation: 'credential_validation_requested',
      installationId,
      teamId
    }, `Credential validation requested for installation ${installationId}`);
  }

  /**
   * Update instance statuses based on credential validation result
   * Updates ALL instances for this installation since credentials are shared
   */
  async updateInstallationCredentialStatus(
    installationId: string,
    result: CredentialValidationResult
  ): Promise<void> {
    const now = new Date();

    if (result.needsReauth) {
      // Set ALL instances to requires_reauth since credentials are shared at installation level
      await this.db
        .update(this.mcpServerInstances)
        .set({
          status: 'requires_reauth',
          status_message: result.error || 'Authentication required',
          status_updated_at: now,
          last_credential_check_at: now
        })
        .where(eq(this.mcpServerInstances.installation_id, installationId));

      this.logger.info({
        operation: 'installation_requires_reauth',
        installationId,
        error: result.error
      }, `All instances for installation ${installationId} set to requires_reauth`);
    } else if (!result.valid) {
      // Invalid credentials but doesn't need reauth (e.g., refresh pending)
      // Just update last_credential_check_at for all instances, don't change status
      await this.db
        .update(this.mcpServerInstances)
        .set({
          last_credential_check_at: now
        })
        .where(eq(this.mcpServerInstances.installation_id, installationId));
    } else {
      // Valid credentials - update last check timestamp for all instances
      await this.db
        .update(this.mcpServerInstances)
        .set({
          last_credential_check_at: now
        })
        .where(eq(this.mcpServerInstances.installation_id, installationId));
    }
  }

  /**
   * Run credential validation for eligible installations
   * Called by cron job every minute, processes batch of installations needing check
   */
  async runCredentialValidation(): Promise<{
    installationsChecked: number;
    oauthValidated: number;
    oauthFailed: number;
    apiKeyRequested: number;
  }> {
    this.logger.trace({
      operation: 'credential_validation_started'
    }, 'Starting credential validation run');

    const installations = await this.getInstallationsNeedingCredentialCheck();

    if (installations.length === 0) {
      this.logger.trace({
        operation: 'credential_validation_complete',
        installationsChecked: 0
      }, 'No installations need credential validation');

      return {
        installationsChecked: 0,
        oauthValidated: 0,
        oauthFailed: 0,
        apiKeyRequested: 0
      };
    }

    let oauthValidated = 0;
    let oauthFailed = 0;
    let apiKeyRequested = 0;

    for (const installation of installations) {
      try {
        if (installation.requires_oauth) {
          // OAuth-based: validate tokens directly
          const result = await this.validateOAuthCredentials(installation.id);
          await this.updateInstallationCredentialStatus(installation.id, result);

          if (result.valid) {
            oauthValidated++;
          } else {
            oauthFailed++;
          }

          this.logger.debug({
            operation: 'oauth_credential_validated',
            installationId: installation.id,
            installationName: installation.installation_name,
            valid: result.valid,
            needsReauth: result.needsReauth
          }, `OAuth validation for ${installation.installation_name}: ${result.valid ? 'valid' : 'invalid'}`);
        } else {
          // API key-based: request satellite validation
          // Only for HTTP/SSE servers (stdio servers use different auth patterns)
          if (installation.transport_type !== 'stdio') {
            await this.requestCredentialValidation(installation.id, installation.team_id);
            apiKeyRequested++;

            // Update last_credential_check_at for all instances to prevent immediate re-check
            const now = new Date();
            await this.db
              .update(this.mcpServerInstances)
              .set({
                last_credential_check_at: now
              })
              .where(eq(this.mcpServerInstances.installation_id, installation.id));
          } else {
            // stdio servers without OAuth - just update timestamp for all instances
            const now = new Date();
            await this.db
              .update(this.mcpServerInstances)
              .set({
                last_credential_check_at: now
              })
              .where(eq(this.mcpServerInstances.installation_id, installation.id));
          }
        }
      } catch (error) {
        this.logger.error({
          operation: 'credential_validation_error',
          installationId: installation.id,
          error: error instanceof Error ? error.message : String(error)
        }, `Credential validation failed for ${installation.installation_name}`);
      }
    }

    this.logger.trace({
      operation: 'credential_validation_complete',
      installationsChecked: installations.length,
      oauthValidated,
      oauthFailed,
      apiKeyRequested
    }, `Credential validation complete: ${installations.length} checked (${oauthValidated} OAuth valid, ${oauthFailed} OAuth failed, ${apiKeyRequested} API key requests)`);

    return {
      installationsChecked: installations.length,
      oauthValidated,
      oauthFailed,
      apiKeyRequested
    };
  }
}
