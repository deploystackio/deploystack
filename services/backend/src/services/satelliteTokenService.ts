import { nanoid } from 'nanoid';
import { hash, verify } from '@node-rs/argon2';
import { getDb } from '../db';
import { satelliteRegistrationTokens } from '../db/schema.sqlite';
import { eq, and, lt } from 'drizzle-orm';
import { SimpleJWT, TokenExpiredError } from '../utils/jwt';
import type { 
  TokenType, 
  SatelliteRegistrationToken, 
  TokenValidationResult, 
  JWTPayload 
} from '../types/satellite';

export class SatelliteTokenService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-for-satellite-tokens';
  private static readonly GLOBAL_TOKEN_PREFIX = 'deploystack_satellite_global_';
  private static readonly TEAM_TOKEN_PREFIX = 'deploystack_satellite_team_';

  /**
   * Generate a new registration token for satellite pairing
   */
  static async generateRegistrationToken(
    tokenType: TokenType,
    createdBy: string,
    teamId?: string,
    expiresInHours?: number
  ): Promise<{ token: string; tokenRecord: SatelliteRegistrationToken }> {
    // Validate parameters
    if (tokenType === 'global' && teamId) {
      throw new Error('Global tokens cannot have team_id');
    }
    if (tokenType === 'team' && !teamId) {
      throw new Error('Team tokens must have team_id');
    }

    // Set default expiration
    const defaultExpiration = tokenType === 'global' ? 1 : 24;
    const expirationHours = expiresInHours || defaultExpiration;
    const expiresAt = new Date(Date.now() + (expirationHours * 60 * 60 * 1000));

    // Generate JWT payload
    const payload: JWTPayload = {
      iss: 'deploystack.io',
      aud: 'satellite-registration',
      exp: Math.floor(expiresAt.getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
      jti: `${tokenType === 'global' ? 'gsat' : 'tsat'}_reg_${nanoid(12)}`,
      scope: tokenType,
      created_by: createdBy,
      permissions: [`register_${tokenType}_satellite`]
    };

    // Add team_id for team tokens
    if (teamId) {
      payload.team_id = teamId;
    }

    // Sign JWT
    const jwtToken = SimpleJWT.sign(payload, this.JWT_SECRET);
    
    // Create full token with prefix
    const tokenPrefix = tokenType === 'global' ? this.GLOBAL_TOKEN_PREFIX : this.TEAM_TOKEN_PREFIX;
    const fullToken = `${tokenPrefix}${jwtToken}`;
    
    // Hash token for storage
    const tokenHash = await hash(fullToken);

    // Create database record
    const tokenId = nanoid();
    const tokenRecord: SatelliteRegistrationToken = {
      id: tokenId,
      token_type: tokenType,
      team_id: teamId || null,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      created_by: createdBy,
      permissions: [`register_${tokenType}_satellite`],
      used: false,
      used_at: null,
      used_by_satellite_id: null,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString()
    };

    // Insert into database
    const db = getDb();
    await db.insert(satelliteRegistrationTokens).values(tokenRecord);

    return { token: fullToken, tokenRecord };
  }

  /**
   * Validate a registration token during satellite registration
   */
  static async validateRegistrationToken(
    token: string
  ): Promise<TokenValidationResult> {
    try {
      // Extract prefix and JWT
      let tokenPrefix: string;
      let jwtToken: string;

      if (token.startsWith(this.GLOBAL_TOKEN_PREFIX)) {
        tokenPrefix = this.GLOBAL_TOKEN_PREFIX;
        jwtToken = token.substring(this.GLOBAL_TOKEN_PREFIX.length);
      } else if (token.startsWith(this.TEAM_TOKEN_PREFIX)) {
        tokenPrefix = this.TEAM_TOKEN_PREFIX;
        jwtToken = token.substring(this.TEAM_TOKEN_PREFIX.length);
      } else {
        return { valid: false, error: 'Invalid token prefix' };
      }

      // Verify JWT signature and expiration
      let payload: JWTPayload;
      try {
        payload = SimpleJWT.verify(jwtToken, this.JWT_SECRET) as JWTPayload;
      } catch (jwtError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (jwtError instanceof TokenExpiredError || (jwtError as any).name === 'TokenExpiredError') {
          return { valid: false, error: 'Token has expired' };
        }
        return { valid: false, error: 'Invalid token signature' };
      }

      // Find token record in database
      // Since we can't directly search by hash (different each time), 
      // we need to get all unused tokens and verify hash
      const db = getDb();
      const candidateTokens = await db.select()
        .from(satelliteRegistrationTokens)
        .where(and(
          eq(satelliteRegistrationTokens.token_prefix, tokenPrefix),
          eq(satelliteRegistrationTokens.used, false)
        ));

      let tokenRecord: SatelliteRegistrationToken | undefined;

      // Find matching token by verifying hash
      for (const candidate of candidateTokens) {
        try {
          const isMatch = await verify(candidate.token_hash, token);
          if (isMatch) {
            tokenRecord = candidate;
            break;
          }
        } catch {
          // Hash verification failed, continue to next candidate
          continue;
        }
      }

      if (!tokenRecord) {
        return { valid: false, error: 'Token not found or invalid' };
      }

      // Verify token hasn't been used (double-check)
      if (tokenRecord.used) {
        return { valid: false, error: 'Token has already been used' };
      }

      // Verify expiration
      if (new Date(tokenRecord.expires_at) < new Date()) {
        return { valid: false, error: 'Token has expired' };
      }

      // Verify scope matches prefix
      const expectedScope = tokenPrefix === this.GLOBAL_TOKEN_PREFIX ? 'global' : 'team';
      if (payload.scope !== expectedScope) {
        return { valid: false, error: 'Token scope mismatch' };
      }

      return { valid: true, tokenRecord };
    } catch (error) {
      console.error('Token validation error:', error);
      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Mark token as used after successful satellite registration
   */
  static async markTokenAsUsed(tokenId: string, satelliteId: string): Promise<void> {
    const db = getDb();
    await db.update(satelliteRegistrationTokens)
      .set({
        used: true,
        used_at: new Date().toISOString(),
        used_by_satellite_id: satelliteId
      })
      .where(eq(satelliteRegistrationTokens.id, tokenId));
  }

  /**
   * Clean up expired tokens (runs periodically)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const db = getDb();
    const now = new Date().toISOString();
    const result = await db.delete(satelliteRegistrationTokens)
      .where(lt(satelliteRegistrationTokens.expires_at, now));
    
    return result.changes || 0;
  }

  /**
   * Get active tokens for admin interface
   */
  static async getActiveTokens(tokenType?: TokenType, teamId?: string) {
    const db = getDb();
    let query = db.select({
      id: satelliteRegistrationTokens.id,
      token_type: satelliteRegistrationTokens.token_type,
      team_id: satelliteRegistrationTokens.team_id,
      created_by: satelliteRegistrationTokens.created_by,
      expires_at: satelliteRegistrationTokens.expires_at,
      created_at: satelliteRegistrationTokens.created_at,
      used: satelliteRegistrationTokens.used
    }).from(satelliteRegistrationTokens);

    const conditions = [];

    if (tokenType) {
      conditions.push(eq(satelliteRegistrationTokens.token_type, tokenType));
    }

    if (teamId) {
      conditions.push(eq(satelliteRegistrationTokens.team_id, teamId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query;
  }

  /**
   * Revoke an unused token
   */
  static async revokeToken(tokenId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(satelliteRegistrationTokens)
      .where(and(
        eq(satelliteRegistrationTokens.id, tokenId),
        eq(satelliteRegistrationTokens.used, false)
      ));
    
    return (result.changes || 0) > 0;
  }
}
