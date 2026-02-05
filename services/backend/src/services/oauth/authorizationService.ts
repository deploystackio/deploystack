/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDb, getSchema } from '../../db';
import { eq, and, lt } from 'drizzle-orm';
import { generateId } from 'lucia';
import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { isClientRegistered, getRegisteredClientsDebugInfo } from '../../routes/oauth2/register';

export interface AuthorizationRequest {
  id: string;
  userId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface AuthorizationCode {
  code: string;
  userId: string;
  teamId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource?: string; // RFC 8707 Resource Indicator
}

export class AuthorizationService {
  private static getDbAndSchema() {
    return {
      db: getDb(),
      schema: getSchema(),
    };
  }

  /**
   * Validate OAuth2 client - Updated for MCP clients with dynamic registration support
   */
  static async validateClient(clientId: string, logger?: FastifyBaseLogger): Promise<boolean> {
    // Support static MCP clients: VS Code, Cursor, Claude.ai, and Cline
    const allowedClients = [
      'vscode_mcp_extension',
      'cursor_mcp_client',
      'claude_ai_mcp_client', 
      'cline_mcp_client'
    ];
    
    if (allowedClients.includes(clientId)) {
      logger?.debug({
        operation: 'validate_client',
        clientId,
        clientType: 'static',
        isValid: true,
      }, 'Static client validation successful');
      return true;
    }
    
    // Support dynamically registered clients (RFC 7591)
    if (clientId.startsWith('dyn_')) {
      try {
        // Get debug info about the registered clients database
        const debugInfo = await getRegisteredClientsDebugInfo(logger!);
        
        logger?.debug({
          operation: 'validate_client',
          clientId,
          clientType: 'dynamic',
          registeredClientsMapInfo: debugInfo,
        }, 'Dynamic client validation - Database contents');
        
        // Use the imported function to check if client is registered
        const isValid = await isClientRegistered(clientId, logger!);
        
        logger?.debug({
          operation: 'validate_client',
          clientId,
          clientType: 'dynamic',
          isValid,
          mapContainsClient: debugInfo.allClientIds.includes(clientId),
        }, 'Dynamic client validation result');
        
        return isValid;
      } catch (error) {
        logger?.error({
          operation: 'validate_client',
          clientId,
          clientType: 'dynamic',
          error: error instanceof Error ? error.message : String(error),
        }, 'Dynamic client validation error');
        return false;
      }
    }
    
    logger?.debug({
      operation: 'validate_client',
      clientId,
      clientType: 'unknown',
      isValid: false,
    }, 'Client validation failed - unknown client type');
    
    return false;
  }

  /**
   * Validate redirect URI - Updated for MCP clients with dynamic client support
   * For static clients: validates against hardcoded patterns
   * For dynamic clients: validates against registered redirect_uris in database
   */
  static async validateRedirectUri(redirectUri: string, clientId: string, logger?: FastifyBaseLogger): Promise<boolean> {
    // For dynamically registered clients (RFC 7591), check database
    if (clientId.startsWith('dyn_')) {
      try {
        const { db, schema } = this.getDbAndSchema();

        // Query the dynamic_oauth_clients table for this client
        const clients = await (db as any)
          .select({
            redirect_uris: schema.dynamicOauthClients.redirect_uris,
          })
          .from(schema.dynamicOauthClients)
          .where(eq(schema.dynamicOauthClients.client_id, clientId))
          .limit(1);

        if (clients.length === 0) {
          logger?.warn({
            operation: 'validate_redirect_uri',
            clientId,
            redirectUri,
            reason: 'client_not_found',
          }, 'Dynamic client not found in database');
          return false;
        }

        const registeredUris = JSON.parse(clients[0].redirect_uris);
        const isValid = registeredUris.includes(redirectUri);

        logger?.debug({
          operation: 'validate_redirect_uri',
          clientId,
          redirectUri,
          registeredUris,
          isValid,
        }, 'Dynamic client redirect URI validation');

        return isValid;
      } catch (error) {
        logger?.error({
          operation: 'validate_redirect_uri',
          clientId,
          redirectUri,
          error: error instanceof Error ? error.message : String(error),
        }, 'Dynamic client redirect URI validation error');
        return false;
      }
    }

    // For static clients: validate against hardcoded patterns
    const allowedPatterns = [
      // Legacy Gateway pattern (can be removed later)
      /^http:\/\/(localhost|127\.0\.0\.1):8976\/oauth\/callback$/,
      // MCP client patterns - flexible localhost ports
      /^http:\/\/(localhost|127\.0\.0\.1):\d+\/oauth\/callback$/,
      /^http:\/\/(localhost|127\.0\.0\.1):\d+\/auth\/callback$/,
      // VS Code MCP extension specific patterns (from actual VS Code logs)
      /^http:\/\/127\.0\.0\.1:\d+\/?$/,
      /^https:\/\/vscode\.dev\/redirect$/,
      // VS Code / Cline extension patterns
      /^vscode:\/\/.*\/auth\/callback$/,
      // Cursor patterns
      /^cursor:\/\/.*\/oauth\/callback$/,
      // Claude.ai MCP OAuth callback patterns (RFC 9728 compliant)
      /^https:\/\/claude\.ai\/api\/mcp\/auth_callback$/,
      /^https:\/\/claude\.com\/api\/mcp\/auth_callback$/  // Future-proofing for domain migration
    ];

    const isValid = allowedPatterns.some(pattern => pattern.test(redirectUri));

    logger?.debug({
      operation: 'validate_redirect_uri',
      clientId,
      redirectUri,
      clientType: 'static',
      isValid,
    }, 'Static client redirect URI validation');

    return isValid;
  }

  /**
   * Validate OAuth2 scope - Updated for MCP scopes
   */
  static validateScope(scope: string): boolean {
    const requestedScopes = scope.split(' ');
    const allowedScopes = [
      'mcp:read',           // Tool discovery within team
      'mcp:tools:execute',  // Tool execution within team
      'offline_access'      // Refresh tokens
    ];
    
    // Check if all requested scopes are allowed
    return requestedScopes.every(s => allowedScopes.includes(s));
  }


  /**
   * Get user's teams for team selection dropdown
   */
  static async getUserTeams(userId: string, logger?: FastifyBaseLogger): Promise<Array<{id: string, name: string, isDefault: boolean}>> {
    const { db, schema } = this.getDbAndSchema();
    
    try {
      const teams = await (db as any)
        .select({
          id: schema.teams.id,
          name: schema.teams.name,
          isDefault: schema.teams.is_default,
        })
        .from(schema.teams)
        .innerJoin(schema.teamMemberships, eq(schema.teams.id, schema.teamMemberships.team_id))
        .where(eq(schema.teamMemberships.user_id, userId))
        .orderBy(schema.teams.name);

      logger?.debug({
        operation: 'get_user_teams',
        userId,
        teamCount: teams.length,
      }, 'Retrieved user teams for OAuth team selection');

      return teams;
    } catch (error) {
      logger?.error({
        operation: 'get_user_teams',
        error,
        userId,
      }, 'Failed to get user teams');
      return [];
    }
  }

  /**
   * Validate team access - Check if user is member of the team
   */
  static async validateTeamAccess(userId: string, teamId: string, logger?: FastifyBaseLogger): Promise<boolean> {
    const { db, schema } = this.getDbAndSchema();
    
    try {
      // Check if user is member of the team
      const result = await (db as any)
        .select()
        .from(schema.teamMemberships)
        .where(
          and(
            eq(schema.teamMemberships.user_id, userId),
            eq(schema.teamMemberships.team_id, teamId)
          )
        )
        .limit(1);

      const isMember = result.length > 0;

      logger?.debug({
        operation: 'validate_team_access',
        userId,
        teamId,
        isMember,
      }, 'Team access validation completed');

      return isMember;
    } catch (error) {
      logger?.error({
        operation: 'validate_team_access',
        error,
        userId,
        teamId,
      }, 'Team access validation error');
      return false;
    }
  }

  /**
   * Store authorization request for consent page
   */
  static async storeAuthorizationRequest(
    userId: string,
    teamId: string,
    clientId: string,
    redirectUri: string,
    scope: string,
    state: string,
    codeChallenge: string,
    codeChallengeMethod: string,
    resource: string | undefined,
    logger?: FastifyBaseLogger
  ): Promise<string> {
    const { db, schema } = this.getDbAndSchema();

    try {
      // Clean up any expired or pending authorization requests for this user/client combo
      // This helps prevent accumulation of unused records
      const now = new Date();
      await (db as any)
        .delete(schema.oauthAuthorizationCodes)
        .where(
          and(
            eq(schema.oauthAuthorizationCodes.user_id, userId),
            eq(schema.oauthAuthorizationCodes.client_id, clientId),
            // Delete if expired OR if it's a pending request (starts with 'pending_')
            lt(schema.oauthAuthorizationCodes.expires_at, now)
          )
        );

      const requestId = generateId(32);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Generate a unique placeholder code for pending authorization
      // This prevents UNIQUE constraint violations when multiple auth requests are made
      const placeholderCode = `pending_${generateId(32)}`;

      // Store authorization request (temporary, for consent page)
      const authRequest = {
        id: requestId,
        user_id: userId,
        team_id: teamId,
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        code: placeholderCode,
        resource: resource || null, // RFC 8707 Resource Indicator
        used: false,
        expires_at: expiresAt,
      };

      await (db as any).insert(schema.oauthAuthorizationCodes).values(authRequest);

      logger?.debug({
        operation: 'store_authorization_request',
        requestId,
        userId,
        clientId,
        scope,
        resource,
        expiresAt: expiresAt.toISOString(),
      }, 'Authorization request stored');

      return requestId;
    } catch (error) {
      logger?.error({
        operation: 'store_authorization_request',
        error,
        userId,
        clientId,
      }, 'Failed to store authorization request');
      throw error;
    }
  }

  /**
   * Get authorization request by ID
   */
  static async getAuthorizationRequest(
    requestId: string,
    logger?: FastifyBaseLogger
  ): Promise<AuthorizationRequest | null> {
    const { db, schema } = this.getDbAndSchema();
    
    try {
      const result = await (db as any)
        .select()
        .from(schema.oauthAuthorizationCodes)
        .where(eq(schema.oauthAuthorizationCodes.id, requestId))
        .limit(1);

      if (!result[0]) {
        logger?.debug({
          operation: 'get_authorization_request',
          requestId,
          found: false,
        }, 'Authorization request not found');
        return null;
      }

      const request = result[0];
      
      // Check if expired
      if (request.expires_at < Date.now()) {
        logger?.debug({
          operation: 'get_authorization_request',
          requestId,
          expired: true,
        }, 'Authorization request expired');
        return null;
      }

      logger?.debug({
        operation: 'get_authorization_request',
        requestId,
        userId: request.user_id,
        clientId: request.client_id,
      }, 'Authorization request retrieved');

      return {
        id: request.id,
        userId: request.user_id,
        clientId: request.client_id,
        redirectUri: request.redirect_uri,
        scope: request.scope,
        state: request.state,
        codeChallenge: request.code_challenge,
        codeChallengeMethod: request.code_challenge_method,
        createdAt: new Date(request.created_at),
        expiresAt: new Date(request.expires_at),
      };
    } catch (error) {
      logger?.error({
        operation: 'get_authorization_request',
        error,
        requestId,
      }, 'Failed to get authorization request');
      return null;
    }
  }

  /**
   * Update the team_id on an authorization request
   * Used when user selects a team during the authorization flow
   */
  static async updateAuthorizationRequestTeam(
    requestId: string,
    teamId: string,
    logger?: FastifyBaseLogger
  ): Promise<boolean> {
    const { db, schema } = this.getDbAndSchema();

    try {
      await (db as any)
        .update(schema.oauthAuthorizationCodes)
        .set({ team_id: teamId })
        .where(eq(schema.oauthAuthorizationCodes.id, requestId));

      logger?.debug({
        operation: 'update_authorization_request_team',
        requestId,
        teamId,
      }, 'Authorization request team updated');

      return true;
    } catch (error) {
      logger?.error({
        operation: 'update_authorization_request_team',
        error,
        requestId,
        teamId,
      }, 'Failed to update authorization request team');
      return false;
    }
  }

  /**
   * Generate authorization code after user consent
   */
  static async generateAuthorizationCode(
    requestId: string,
    logger?: FastifyBaseLogger
  ): Promise<string | null> {
    const { db, schema } = this.getDbAndSchema();
    
    try {
      // Get the authorization request
      const authRequest = await this.getAuthorizationRequest(requestId, logger);
      if (!authRequest) {
        return null;
      }

      // Generate authorization code
      const code = generateId(32);
      
      // Update the request with the code
      await (db as any)
        .update(schema.oauthAuthorizationCodes)
        .set({ code })
        .where(eq(schema.oauthAuthorizationCodes.id, requestId));

      logger?.debug({
        operation: 'generate_authorization_code',
        requestId,
        userId: authRequest.userId,
        clientId: authRequest.clientId,
      }, 'Authorization code generated');

      return code;
    } catch (error) {
      logger?.error({
        operation: 'generate_authorization_code',
        error,
        requestId,
      }, 'Failed to generate authorization code');
      return null;
    }
  }

  /**
   * Verify authorization code and PKCE challenge
   */
  static async verifyAuthorizationCode(
    code: string,
    codeVerifier: string,
    clientId: string,
    redirectUri: string,
    logger?: FastifyBaseLogger
  ): Promise<AuthorizationCode | null> {
    const { db, schema } = this.getDbAndSchema();
    
    try {
      // Reject placeholder codes immediately
      if (code.startsWith('pending_')) {
        logger?.warn({
          operation: 'verify_authorization_code',
          error: 'Attempted to verify placeholder code',
        }, 'Invalid authorization code - placeholder code submitted');
        return null;
      }
      
      // Find authorization code
      const result = await (db as any)
        .select()
        .from(schema.oauthAuthorizationCodes)
        .where(
          and(
            eq(schema.oauthAuthorizationCodes.code, code),
            eq(schema.oauthAuthorizationCodes.client_id, clientId),
            eq(schema.oauthAuthorizationCodes.redirect_uri, redirectUri),
            eq(schema.oauthAuthorizationCodes.used, false)
          )
        )
        .limit(1);

      if (!result[0]) {
        logger?.warn({
          operation: 'verify_authorization_code',
          code: code.substring(0, 8) + '...',
          clientId,
          error: 'Authorization code not found',
        }, 'Authorization code verification failed');
        return null;
      }

      const authCode = result[0];

      // Check if expired
      if (authCode.expires_at < Date.now()) {
        logger?.debug({
          operation: 'verify_authorization_code',
          code: code.substring(0, 8) + '...',
          error: 'Authorization code expired',
        }, 'Authorization code verification failed');
        return null;
      }

      // Verify PKCE challenge
      const isValidChallenge = this.verifyPKCEChallenge(
        codeVerifier,
        authCode.code_challenge,
        authCode.code_challenge_method
      );

      if (!isValidChallenge) {
        logger?.warn({
          operation: 'verify_authorization_code',
          code: code.substring(0, 8) + '...',
          error: 'PKCE challenge verification failed',
        }, 'Authorization code verification failed');
        return null;
      }

      // Mark code as used
      await (db as any)
        .update(schema.oauthAuthorizationCodes)
        .set({ used: true })
        .where(eq(schema.oauthAuthorizationCodes.id, authCode.id));

      logger?.debug({
        operation: 'verify_authorization_code',
        code: code.substring(0, 8) + '...',
        userId: authCode.user_id,
        clientId,
      }, 'Authorization code verified successfully');

      return {
        code: authCode.code,
        userId: authCode.user_id,
        teamId: authCode.team_id,
        clientId: authCode.client_id,
        redirectUri: authCode.redirect_uri,
        scope: authCode.scope,
        state: authCode.state,
        codeChallenge: authCode.code_challenge,
        codeChallengeMethod: authCode.code_challenge_method,
        resource: authCode.resource || undefined, // RFC 8707 Resource Indicator
      };
    } catch (error) {
      logger?.error({
        operation: 'verify_authorization_code',
        error,
        code: code.substring(0, 8) + '...',
        clientId,
      }, 'Authorization code verification error');
      return null;
    }
  }

  /**
   * Verify PKCE code challenge
   */
  private static verifyPKCEChallenge(
    codeVerifier: string,
    codeChallenge: string,
    codeChallengeMethod: string
  ): boolean {
    try {
      if (codeChallengeMethod === 'S256') {
        // SHA256 hash of code verifier, base64url encoded
        const hash = crypto.createHash('sha256').update(codeVerifier).digest();
        const computedChallenge = hash
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        
        return computedChallenge === codeChallenge;
      } else if (codeChallengeMethod === 'plain') {
        // Plain text comparison (not recommended but supported)
        return codeVerifier === codeChallenge;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Clean up expired authorization codes
   */
  static async cleanupExpiredAuthorizationCodes(logger?: FastifyBaseLogger): Promise<void> {
    const { db, schema } = this.getDbAndSchema();
    
    try {
      const now = new Date(); // Use Date object instead of timestamp
      
      const result = await (db as any)
        .delete(schema.oauthAuthorizationCodes)
        .where(lt(schema.oauthAuthorizationCodes.expires_at, now));

      logger?.info({
        operation: 'cleanup_expired_authorization_codes',
        deleted: result.rowCount || 0,
      }, 'Expired authorization codes cleaned up');
    } catch (error) {
      logger?.error({
        operation: 'cleanup_expired_authorization_codes',
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      }, 'Authorization code cleanup error');
      throw error;
    }
  }

  /**
   * Generate state parameter for CSRF protection
   */
  static generateState(): string {
    return generateId(32);
  }

  /**
   * Generate PKCE code verifier
   */
  static generateCodeVerifier(): string {
    return generateId(64);
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  static generateCodeChallenge(codeVerifier: string): string {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    return hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
