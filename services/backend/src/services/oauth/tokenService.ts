/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDb, getSchema } from '../../db';
import { eq, and, lt } from 'drizzle-orm';
import { generateId } from 'lucia';
import { hash, verify } from '@node-rs/argon2';
import type { FastifyBaseLogger } from 'fastify';

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface AccessTokenPayload {
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
  };
  scope: string[];
  clientId: string;
  tokenId: string;
  team_id: string;        // Team context for token
  team_name: string;      // Team name
  team_role: string;      // User's role in team
  team_permissions: string[]; // Team permissions
  aud?: string[];         // RFC 8707 Resource Indicator - Audience claim
}

export class TokenService {
  private static getDbAndSchema() {
    return {
      db: getDb(),
      schema: getSchema(),
    };
  }

  /**
   * Get team data and user's role in team
   */
  private static async getTeamData(userId: string, teamId: string) {
    const { db, schema } = this.getDbAndSchema();
    
    // Get team info and user's role in team
    const result = await (db as any)
      .select({
        team_name: schema.teams.name,
        team_role: schema.teamMemberships.role,
      })
      .from(schema.teams)
      .innerJoin(schema.teamMemberships, eq(schema.teams.id, schema.teamMemberships.team_id))
      .where(
        and(
          eq(schema.teams.id, teamId),
          eq(schema.teamMemberships.user_id, userId)
        )
      )
      .limit(1);

    if (!result[0]) {
      throw new Error('User not member of team');
    }

    return {
      name: result[0].team_name,
      role: result[0].team_role,
      permissions: ['mcp.tools.execute'] // Based on team role - can be expanded later
    };
  }

  /**
   * Generate access token with user and team information
   */
  static async generateAccessToken(
    userId: string,
    teamId: string,
    scope: string,
    clientId: string,
    resource: string | undefined,
    logger?: FastifyBaseLogger
  ): Promise<string> {
    const { db, schema } = this.getDbAndSchema();

    try {
      // Get user information
      const userResult = await (db as any)
        .select({
          id: schema.authUser.id,
          email: schema.authUser.email,
          username: schema.authUser.username,
          firstName: schema.authUser.first_name,
          lastName: schema.authUser.last_name,
        })
        .from(schema.authUser)
        .where(eq(schema.authUser.id, userId))
        .limit(1);

      if (!userResult[0]) {
        throw new Error('User not found');
      }

      // Get team information and user's role in team
      const teamData = await this.getTeamData(userId, teamId);

      const user = userResult[0];
      const tokenId = generateId(32);
      const rawToken = generateId(64); // 512-bit token

      // Generate audience claim from resource parameter (RFC 8707)
      let aud: string[] | undefined;
      if (resource) {
        // Use provided resource as audience
        aud = [resource];
      } else {
        // Fallback: generic team audience for backward compatibility
        aud = [`deploystack:team:${teamId}`];
      }

      // Create token payload with team context
      const payload: AccessTokenPayload = {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        scope: scope.split(' '),
        clientId,
        tokenId,
        team_id: teamId,
        team_name: teamData.name,
        team_role: teamData.role,
        team_permissions: teamData.permissions,
        aud, // RFC 8707 Resource Indicator
      };

      // Create JWT-like token (base64 encoded JSON for simplicity)
      const tokenData = {
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 3600), // 1 week
      };

      const accessToken = `${rawToken}.${Buffer.from(JSON.stringify(tokenData)).toString('base64')}`;
      
      // Hash the token for storage
      const tokenHash = await hash(accessToken, {
        memoryCost: 65536,
        timeCost: 3,
        outputLen: 32,
        parallelism: 1,
      });

      // Store in database
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 1 week
      await (db as any).insert(schema.oauthAccessTokens).values({
        id: tokenId,
        user_id: userId,
        team_id: teamId,
        client_id: clientId,
        scope,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      logger?.debug({
        operation: 'generate_access_token',
        userId,
        clientId,
        scope,
        resource,
        aud,
        tokenId,
        expiresAt: expiresAt.toISOString(),
      }, 'Access token generated successfully');

      return accessToken;
    } catch (error) {
      logger?.error({
        operation: 'generate_access_token',
        error,
        userId,
        clientId,
      }, 'Failed to generate access token');
      throw error;
    }
  }

  /**
   * Generate refresh token
   */
  static async generateRefreshToken(
    userId: string,
    teamId: string,
    clientId: string,
    logger?: FastifyBaseLogger
  ): Promise<string> {
    const { db, schema } = this.getDbAndSchema();
    
    try {
      const tokenId = generateId(32);
      const rawToken = generateId(64); // 512-bit token
      
      // Hash the token for storage
      const tokenHash = await hash(rawToken, {
        memoryCost: 65536,
        timeCost: 3,
        outputLen: 32,
        parallelism: 1,
      });

      // Store in database (30 days expiration)
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      await (db as any).insert(schema.oauthRefreshTokens).values({
        id: tokenId,
        user_id: userId,
        team_id: teamId,
        client_id: clientId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      logger?.debug({
        operation: 'generate_refresh_token',
        userId,
        teamId,
        clientId,
        tokenId,
        expiresAt: expiresAt.toISOString(),
      }, 'Refresh token generated successfully');

      return rawToken;
    } catch (error) {
      logger?.error({
        operation: 'generate_refresh_token',
        error,
        userId,
        teamId,
        clientId,
      }, 'Failed to generate refresh token');
      throw error;
    }
  }

  /**
   * Verify and decode access token
   */
  static async verifyAccessToken(
    accessToken: string,
    logger?: FastifyBaseLogger
  ): Promise<AccessTokenPayload | null> {
    const { db, schema } = this.getDbAndSchema();
    
    try {
      // Parse token format: rawToken.base64Payload
      const parts = accessToken.split('.');
      if (parts.length !== 2) {
        logger?.warn({
          operation: 'verify_access_token',
          error: 'Invalid token format',
        }, 'Access token verification failed');
        return null;
      }

      const [, encodedPayload] = parts;
      
      // Decode payload
      let payload: AccessTokenPayload & { iat: number; exp: number };
      try {
        payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString());
      } catch {
        logger?.warn({
          operation: 'verify_access_token',
          error: 'Invalid token payload',
        }, 'Access token verification failed');
        return null;
      }

      // Check expiration
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        logger?.debug({
          operation: 'verify_access_token',
          tokenId: payload.tokenId,
          error: 'Token expired',
        }, 'Access token verification failed');
        return null;
      }

      // Verify token exists in database and is not expired
      const tokenResult = await (db as any)
        .select()
        .from(schema.oauthAccessTokens)
        .where(
          and(
            eq(schema.oauthAccessTokens.id, payload.tokenId),
            eq(schema.oauthAccessTokens.user_id, payload.user.id)
          )
        )
        .limit(1);

      if (!tokenResult[0]) {
        logger?.warn({
          operation: 'verify_access_token',
          tokenId: payload.tokenId,
          userId: payload.user.id,
          error: 'Token not found in database',
        }, 'Access token verification failed');
        return null;
      }

      const storedToken = tokenResult[0];

      // Check database expiration
      if (storedToken.expires_at < Date.now()) {
        logger?.debug({
          operation: 'verify_access_token',
          tokenId: payload.tokenId,
          error: 'Token expired in database',
        }, 'Access token verification failed');
        return null;
      }

      // Verify token hash
      const isValid = await verify(storedToken.token_hash, accessToken);
      if (!isValid) {
        logger?.warn({
          operation: 'verify_access_token',
          tokenId: payload.tokenId,
          error: 'Token hash verification failed',
        }, 'Access token verification failed');
        return null;
      }

      logger?.debug({
        operation: 'verify_access_token',
        tokenId: payload.tokenId,
        userId: payload.user.id,
        scope: payload.scope,
      }, 'Access token verified successfully');

      return {
        user: payload.user,
        scope: payload.scope,
        clientId: payload.clientId,
        tokenId: payload.tokenId,
        team_id: payload.team_id,
        team_name: payload.team_name,
        team_role: payload.team_role,
        team_permissions: payload.team_permissions,
      };
    } catch (error) {
      logger?.error({
        operation: 'verify_access_token',
        error,
      }, 'Access token verification error');
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    logger?: FastifyBaseLogger
  ): Promise<TokenResponse | null> {
    const { db, schema } = this.getDbAndSchema();
    
    try {
      // Find refresh token in database
      const refreshTokenResult = await (db as any)
        .select()
        .from(schema.oauthRefreshTokens)
        .where(
          and(
            eq(schema.oauthRefreshTokens.client_id, clientId),
            eq(schema.oauthRefreshTokens.used, false)
          )
        );

      let validRefreshToken = null;
      for (const storedToken of refreshTokenResult) {
        // Check if token is expired
        if (storedToken.expires_at < Date.now()) {
          continue;
        }

        // Verify token hash
        const isValid = await verify(storedToken.token_hash, refreshToken);
        if (isValid) {
          validRefreshToken = storedToken;
          break;
        }
      }

      if (!validRefreshToken) {
        logger?.warn({
          operation: 'refresh_access_token',
          clientId,
          error: 'Invalid or expired refresh token',
        }, 'Token refresh failed');
        return null;
      }

      // Mark refresh token as used
      await (db as any)
        .update(schema.oauthRefreshTokens)
        .set({ used: true })
        .where(eq(schema.oauthRefreshTokens.id, validRefreshToken.id));

      // Generate new tokens - Note: For refresh tokens, we need the team_id from the original token
      // This is a limitation of the current refresh token design - we'll need to store team_id in refresh tokens
      // For now, we'll throw an error indicating this needs to be implemented
      throw new Error('Refresh token flow needs to be updated for team-aware tokens');
    } catch (error) {
      logger?.error({
        operation: 'refresh_access_token',
        error,
        clientId,
      }, 'Token refresh error');
      return null;
    }
  }

  /**
   * Revoke access token
   */
  static async revokeAccessToken(
    tokenId: string,
    logger?: FastifyBaseLogger
  ): Promise<boolean> {
    const { db, schema } = this.getDbAndSchema();
    
    try {
      const result = await (db as any)
        .delete(schema.oauthAccessTokens)
        .where(eq(schema.oauthAccessTokens.id, tokenId));

      logger?.debug({
        operation: 'revoke_access_token',
        tokenId,
        deleted: (result.rowCount || 0) > 0,
      }, 'Access token revocation attempted');

      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger?.error({
        operation: 'revoke_access_token',
        error,
        tokenId,
      }, 'Access token revocation error');
      return false;
    }
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpiredTokens(logger?: FastifyBaseLogger): Promise<void> {
    const { db, schema } = this.getDbAndSchema();
    
    try {
      const now = new Date(); // Use Date object instead of timestamp

      // Clean up expired access tokens
      const accessTokenResult = await (db as any)
        .delete(schema.oauthAccessTokens)
        .where(lt(schema.oauthAccessTokens.expires_at, now));

      // Clean up expired refresh tokens
      const refreshTokenResult = await (db as any)
        .delete(schema.oauthRefreshTokens)
        .where(lt(schema.oauthRefreshTokens.expires_at, now));

      logger?.info({
        operation: 'cleanup_expired_tokens',
        accessTokensDeleted: accessTokenResult.rowCount || 0,
        refreshTokensDeleted: refreshTokenResult.rowCount || 0,
      }, 'Expired tokens cleaned up');
    } catch (error) {
      logger?.error({
        operation: 'cleanup_expired_tokens',
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      }, 'Token cleanup error');
      throw error;
    }
  }
}
