import { nanoid } from 'nanoid';
import { hash, verify } from '@node-rs/argon2';
import { getDb, getSchema } from '../db';
import { eq, and, lt, count, desc } from 'drizzle-orm';
import { SimpleJWT, TokenExpiredError } from '../utils/jwt';
import type {
  TokenType,
  SatelliteRegistrationToken,
  TokenValidationResult,
  JWTPayload
} from '../types/satellite';
import type { FastifyBaseLogger } from 'fastify';

export class SatelliteTokenService {
  private static getSchema() {
    return getSchema();
  }
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
    await db.insert(this.getSchema().satelliteRegistrationTokens).values(tokenRecord);

    return { token: fullToken, tokenRecord };
  }

  /**
   * Validate a registration token during satellite registration
   */
  static async validateRegistrationToken(
    token: string,
    logger: FastifyBaseLogger
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
        .from(this.getSchema().satelliteRegistrationTokens)
        .where(and(
          eq(this.getSchema().satelliteRegistrationTokens.token_prefix, tokenPrefix),
          eq(this.getSchema().satelliteRegistrationTokens.used, false)
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
      logger.error({
        error,
        operation: 'validate_registration_token',
        tokenPrefix: token.startsWith(this.GLOBAL_TOKEN_PREFIX) ? 'global' : 
                    token.startsWith(this.TEAM_TOKEN_PREFIX) ? 'team' : 'unknown'
      }, 'Token validation failed');
      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Mark token as used after successful satellite registration
   */
  static async markTokenAsUsed(tokenId: string, satelliteId: string): Promise<void> {
    const db = getDb();
    await db.update(this.getSchema().satelliteRegistrationTokens)
      .set({
        used: true,
        used_at: new Date().toISOString(),
        used_by_satellite_id: satelliteId
      })
      .where(eq(this.getSchema().satelliteRegistrationTokens.id, tokenId));
  }

  /**
   * Clean up expired tokens (runs periodically)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const db = getDb();
    const now = new Date().toISOString();
    const result = await db.delete(this.getSchema().satelliteRegistrationTokens)
      .where(lt(this.getSchema().satelliteRegistrationTokens.expires_at, now));
    
    return result.rowCount || 0;
  }

  /**
   * Get active tokens for admin interface
   */
  static async getActiveTokens(tokenType?: TokenType, teamId?: string) {
    const db = getDb();
    const queryBuilder = db.select({
      id: this.getSchema().satelliteRegistrationTokens.id,
      token_type: this.getSchema().satelliteRegistrationTokens.token_type,
      team_id: this.getSchema().satelliteRegistrationTokens.team_id,
      created_by: this.getSchema().satelliteRegistrationTokens.created_by,
      expires_at: this.getSchema().satelliteRegistrationTokens.expires_at,
      created_at: this.getSchema().satelliteRegistrationTokens.created_at,
      used: this.getSchema().satelliteRegistrationTokens.used
    }).from(this.getSchema().satelliteRegistrationTokens);

    const conditions = [];

    if (tokenType) {
      conditions.push(eq(this.getSchema().satelliteRegistrationTokens.token_type, tokenType));
    }

    if (teamId) {
      conditions.push(eq(this.getSchema().satelliteRegistrationTokens.team_id, teamId));
    }

    return await (conditions.length > 0
      ? queryBuilder.where(and(...conditions))
      : queryBuilder);
  }

  /**
   * Get all registration tokens a user has access to (for unified listing)
   */
  static async getAllTokensForUser(
    userId: string, 
    userRole: string, 
    page: number = 1, 
    limit: number = 50
  ) {
    const db = getDb();
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    let query;
    let countQuery;
    
    if (userRole === 'global_admin') {
      // Global admins see all tokens
      query = db.select({
        id: this.getSchema().satelliteRegistrationTokens.id,
        token: this.getSchema().satelliteRegistrationTokens.token_prefix, // Return masked token for display
        token_type: this.getSchema().satelliteRegistrationTokens.token_type,
        team_id: this.getSchema().satelliteRegistrationTokens.team_id,
        team_slug: this.getSchema().satelliteRegistrationTokens.team_id, // TODO: Join with teams table for slug
        created_by: this.getSchema().satelliteRegistrationTokens.created_by,
        creator_name: this.getSchema().authUser.username,
        creator_email: this.getSchema().authUser.email,
        creator_display_name: this.getSchema().authUser.first_name,
        creator_last_name: this.getSchema().authUser.last_name,
        expires_at: this.getSchema().satelliteRegistrationTokens.expires_at,
        created_at: this.getSchema().satelliteRegistrationTokens.created_at,
        used: this.getSchema().satelliteRegistrationTokens.used,
        used_at: this.getSchema().satelliteRegistrationTokens.used_at,
        used_by: this.getSchema().satelliteRegistrationTokens.used_by_satellite_id
      })
      .from(this.getSchema().satelliteRegistrationTokens)
      .leftJoin(this.getSchema().authUser, eq(this.getSchema().satelliteRegistrationTokens.created_by, this.getSchema().authUser.id))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(this.getSchema().satelliteRegistrationTokens.created_at));
      
      countQuery = db.select({ count: count() })
        .from(this.getSchema().satelliteRegistrationTokens);
        
    } else {
      // Regular users only see tokens they created
      query = db.select({
        id: this.getSchema().satelliteRegistrationTokens.id,
        token: this.getSchema().satelliteRegistrationTokens.token_prefix, // Return masked token for display
        token_type: this.getSchema().satelliteRegistrationTokens.token_type,
        team_id: this.getSchema().satelliteRegistrationTokens.team_id,
        team_slug: this.getSchema().satelliteRegistrationTokens.team_id, // TODO: Join with teams table for slug
        created_by: this.getSchema().satelliteRegistrationTokens.created_by,
        creator_name: this.getSchema().authUser.username,
        creator_email: this.getSchema().authUser.email,
        creator_display_name: this.getSchema().authUser.first_name,
        creator_last_name: this.getSchema().authUser.last_name,
        expires_at: this.getSchema().satelliteRegistrationTokens.expires_at,
        created_at: this.getSchema().satelliteRegistrationTokens.created_at,
        used: this.getSchema().satelliteRegistrationTokens.used,
        used_at: this.getSchema().satelliteRegistrationTokens.used_at,
        used_by: this.getSchema().satelliteRegistrationTokens.used_by_satellite_id
      })
      .from(this.getSchema().satelliteRegistrationTokens)
      .leftJoin(this.getSchema().authUser, eq(this.getSchema().satelliteRegistrationTokens.created_by, this.getSchema().authUser.id))
      .where(eq(this.getSchema().satelliteRegistrationTokens.created_by, userId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(this.getSchema().satelliteRegistrationTokens.created_at));
      
      countQuery = db.select({ count: count() })
        .from(this.getSchema().satelliteRegistrationTokens)
        .where(eq(this.getSchema().satelliteRegistrationTokens.created_by, userId));
    }
    
    // Execute queries
    const [rawTokens, totalResult] = await Promise.all([
      query,
      countQuery
    ]);
    
    // Process the results to format user display names
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokens = rawTokens.map((token: any) => {
      // Create a display name from first_name, last_name, username, and email
      let displayName = '';
      
      if (token.creator_display_name && token.creator_last_name) {
        displayName = `${token.creator_display_name} ${token.creator_last_name}`;
      } else if (token.creator_display_name) {
        displayName = token.creator_display_name;
      } else if (token.creator_name) {
        displayName = token.creator_name;
      } else {
        displayName = token.created_by; // Fallback to user ID
      }
      
      // Add email in parentheses if available
      if (token.creator_email) {
        displayName += ` (${token.creator_email})`;
      }
      
      return {
        id: token.id,
        token: token.token,
        token_type: token.token_type,
        team_id: token.team_id,
        team_slug: token.team_slug,
        created_by: token.created_by,
        creator_name: displayName, // This will now be "John Doe (john@example.com)"
        expires_at: token.expires_at,
        created_at: token.created_at,
        used: token.used,
        used_at: token.used_at,
        used_by: token.used_by
      };
    });
    
    const total = totalResult[0]?.count || 0;
    const pages = Math.ceil(total / limit);
    
    return {
      data: tokens,
      pagination: {
        total,
        page,
        pages,
        limit
      }
    };
  }

  /**
   * Revoke an unused token
   */
  static async revokeToken(tokenId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(this.getSchema().satelliteRegistrationTokens)
      .where(and(
        eq(this.getSchema().satelliteRegistrationTokens.id, tokenId),
        eq(this.getSchema().satelliteRegistrationTokens.used, false)
      ));

    return (result.rowCount || 0) > 0;
  }
}
