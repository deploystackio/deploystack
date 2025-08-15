/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDb, getSchema } from '../../db';
import { eq, and, lt } from 'drizzle-orm';
import { generateId } from 'lucia';
import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';

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
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

export class AuthorizationService {
  private static getDbAndSchema() {
    return {
      db: getDb(),
      schema: getSchema(),
    };
  }

  /**
   * Validate OAuth2 client
   */
  static validateClient(clientId: string): boolean {
    // For now, only support the deploystack-gateway-cli client
    return clientId === 'deploystack-gateway-cli';
  }

  /**
   * Validate redirect URI
   */
  static validateRedirectUri(redirectUri: string): boolean {
    const allowedRedirects = [
      'http://localhost:8976/oauth/callback',
      'http://127.0.0.1:8976/oauth/callback'
    ];
    return allowedRedirects.includes(redirectUri);
  }

  /**
   * Validate OAuth2 scope
   */
  static validateScope(scope: string): boolean {
    const requestedScopes = scope.split(' ');
    const allowedScopes = [
      'mcp:read',
      'mcp:categories:read',
      'account:read',
      'user:read',
      'teams:read',
      'gateway:config:read',
      'offline_access'
    ];
    
    // Check if all requested scopes are allowed
    return requestedScopes.every(s => allowedScopes.includes(s));
  }

  /**
   * Store authorization request for consent page
   */
  static async storeAuthorizationRequest(
    userId: string,
    clientId: string,
    redirectUri: string,
    scope: string,
    state: string,
    codeChallenge: string,
    codeChallengeMethod: string,
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
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        code: placeholderCode,
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
        clientId: authCode.client_id,
        redirectUri: authCode.redirect_uri,
        scope: authCode.scope,
        state: authCode.state,
        codeChallenge: authCode.code_challenge,
        codeChallengeMethod: authCode.code_challenge_method,
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
        deleted: result.changes || 0,
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
