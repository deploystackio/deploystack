import { getDb, getSchema } from '../db';
import { eq, lt, gt, and } from 'drizzle-orm';
import { generateId } from 'lucia';
import { hash, verify } from '@node-rs/argon2';
import type { FastifyBaseLogger } from 'fastify';
import { GlobalSettings } from '../global-settings/helpers';

export class PasswordResetService {
  /**
   * Generate a secure reset token
   */
  static generateToken(): string {
    return generateId(32); // 32 character random string
  }

  /**
   * Hash a reset token for secure storage
   */
  static async hashToken(token: string): Promise<string> {
    return await hash(token, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });
  }

  /**
   * Verify a token against its hash
   */
  static async verifyToken(token: string, hash: string): Promise<boolean> {
    return await verify(hash, token, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });
  }

  /**
   * Create a reset token for a user
   */
  static async createResetToken(userId: string): Promise<string> {
    const db = getDb();
    const schema = getSchema();
    const passwordResetTokensTable = schema.passwordResetTokens;

    if (!passwordResetTokensTable) {
      throw new Error('Password reset tokens table not found');
    }

    // Generate token and hash it
    const token = this.generateToken();
    const tokenHash = await this.hashToken(token);
    
    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Delete any existing tokens for this user
    await this.deleteUserTokens(userId);

    // Insert new token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).insert(passwordResetTokensTable).values({
      id: generateId(15),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    return token;
  }

  /**
   * Validate reset token and reset password
   */
  static async validateAndResetPassword(token: string, newPassword: string, logger: FastifyBaseLogger): Promise<{ success: boolean; error?: string; userId?: string }> {
    const db = getDb();
    const schema = getSchema();
    const passwordResetTokensTable = schema.passwordResetTokens;
    const authUserTable = schema.authUser;

    if (!passwordResetTokensTable || !authUserTable) {
      const error = 'Database tables not found';
      logger.error({ error }, 'Database configuration error during password reset');
      return { success: false, error };
    }

    try {
      logger.debug({
        tokenLength: token.length,
        tokenStart: token.substring(0, 8) + '...',
        operation: 'validate_reset_password'
      }, 'Starting password reset token validation');

      // Get all non-expired tokens with more detailed logging
      const currentTime = new Date();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokens = await (db as any)
        .select()
        .from(passwordResetTokensTable)
        .where(gt(passwordResetTokensTable.expires_at, currentTime));

      logger.debug({
        totalTokensFound: tokens.length,
        currentTime: currentTime.toISOString(),
        operation: 'validate_reset_password'
      }, 'Retrieved non-expired tokens from database');

      if (tokens.length === 0) {
        logger.warn('No non-expired tokens found in database');
        return { success: false, error: 'Invalid or expired reset token' };
      }

      // Find matching token with detailed logging
      let matchingToken = null;
      let verificationAttempts = 0;
      
      for (const dbToken of tokens) {
        verificationAttempts++;
        logger.debug({
          attempt: verificationAttempts,
          tokenId: dbToken.id,
          expiresAt: dbToken.expires_at,
          userId: dbToken.user_id
        }, 'Attempting token verification');
        
        const isValid = await this.verifyToken(token, dbToken.token_hash);
        
        logger.debug({
          attempt: verificationAttempts,
          tokenId: dbToken.id,
          isValid
        }, 'Token verification result');
        
        if (isValid) {
          matchingToken = dbToken;
          logger.debug({
            tokenId: dbToken.id,
            userId: dbToken.user_id,
            attempts: verificationAttempts
          }, 'Found matching token');
          break;
        }
      }

      if (!matchingToken) {
        logger.warn({
          totalAttempts: verificationAttempts,
          providedTokenLength: token.length,
          operation: 'validate_reset_password'
        }, 'No matching token found after verification attempts');
        return { success: false, error: 'Invalid or expired reset token' };
      }

      // Get user to verify they have email auth
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const users = await (db as any)
        .select()
        .from(authUserTable)
        .where(and(
          eq(authUserTable.id, matchingToken.user_id),
          eq(authUserTable.auth_type, 'email_signup')
        ))
        .limit(1);

      if (users.length === 0) {
        return { success: false, error: 'User not found or not eligible for password reset' };
      }

      // const user = users[0];

      // Hash new password
      const hashedNewPassword = await hash(newPassword, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });

      // Update password in database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .update(authUserTable)
        .set({ 
          hashed_password: hashedNewPassword,
          updated_at: new Date()
        })
        .where(eq(authUserTable.id, matchingToken.user_id));

      // Delete the used token
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .delete(passwordResetTokensTable)
        .where(eq(passwordResetTokensTable.id, matchingToken.id));

      // Invalidate all user sessions for security
      await this.invalidateAllUserSessions(matchingToken.user_id, logger);

      return { success: true, userId: matchingToken.user_id };
    } catch (error) {
      logger.error({
        error,
        operation: 'validate_reset_password'
      }, 'Error validating reset token and resetting password');
      return { success: false, error: 'An error occurred during password reset' };
    }
  }

  /**
   * Invalidate all sessions for a user (security measure after password reset)
   */
  static async invalidateAllUserSessions(userId: string, logger?: FastifyBaseLogger): Promise<void> {
    const db = getDb();
    const schema = getSchema();
    const authSessionTable = schema.authSession;

    if (!authSessionTable) {
      return;
    }

    try {
      // Delete all sessions for this user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .delete(authSessionTable)
        .where(eq(authSessionTable.user_id, userId));
    } catch (error) {
      if (logger) {
        logger.error({
          error,
          userId,
          operation: 'invalidate_user_sessions'
        }, 'Error invalidating user sessions');
      }
      // Don't throw error here as password reset was successful
    }
  }

  /**
   * Delete all reset tokens for a user
   */
  static async deleteUserTokens(userId: string): Promise<void> {
    const db = getDb();
    const schema = getSchema();
    const passwordResetTokensTable = schema.passwordResetTokens;

    if (!passwordResetTokensTable) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .delete(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.user_id, userId));
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const db = getDb();
    const schema = getSchema();
    const passwordResetTokensTable = schema.passwordResetTokens;

    if (!passwordResetTokensTable) {
      return 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (db as any)
      .delete(passwordResetTokensTable)
      .where(lt(passwordResetTokensTable.expires_at, new Date()));

    return result.changes || 0;
  }

  /**
   * Prepare password reset email data for background job
   * Does not send email directly - returns email data for job queue
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async prepareResetEmail(email: string, logger?: FastifyBaseLogger): Promise<{ success: boolean; error?: string; emailData?: any }> {
    try {
      // Check if email sending is enabled
      const isEmailEnabled = await GlobalSettings.getBoolean('smtp.enabled', false);
      if (!isEmailEnabled) {
        return { success: false, error: 'Password reset is currently disabled. Email functionality is not enabled.' };
      }

      const db = getDb();
      const schema = getSchema();
      const authUserTable = schema.authUser;

      if (!authUserTable) {
        return { success: false, error: 'Database configuration error' };
      }

      // Find user with email auth type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const users = await (db as any)
        .select()
        .from(authUserTable)
        .where(and(
          eq(authUserTable.email, email.toLowerCase()),
          eq(authUserTable.auth_type, 'email_signup')
        ))
        .limit(1);

      // Always return success for security (don't reveal if email exists)
      if (users.length === 0) {
        return { success: true }; // Don't reveal that email doesn't exist
      }

      const user = users[0];

      // Generate reset token
      const token = await this.createResetToken(user.id);

      // Get frontend URL for reset link
      const frontendUrl = await GlobalSettings.get('global.page_url', 'http://localhost:5173');
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
      const supportEmail = await GlobalSettings.get('smtp.from_email') || undefined;

      // Return email data for background job
      return {
        success: true,
        emailData: {
          to: user.email,
          subject: 'Reset Your Password',
          template: 'password-reset',
          variables: {
            userName: user.username,
            userEmail: user.email,
            resetUrl,
            expirationTime: '10 minutes',
            supportEmail
          }
        }
      };
    } catch (error) {
      if (logger) {
        logger.error({
          error,
          email,
          operation: 'prepare_reset_email'
        }, 'Error preparing password reset email');
      }
      return { success: false, error: 'An error occurred while preparing reset email' };
    }
  }

  /**
   * Prepare admin-initiated password reset email data for background job
   * Only for users with auth_type = 'email_signup'
   * Admin cannot reset their own password
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async prepareAdminResetEmail(email: string, adminUserId: string, logger?: FastifyBaseLogger): Promise<{ success: boolean; error?: string; emailData?: any }> {
    try {
      // Check if email sending is enabled
      const isEmailEnabled = await GlobalSettings.getBoolean('smtp.enabled', false);
      if (!isEmailEnabled) {
        return { success: false, error: 'Password reset is currently disabled. Email functionality is not enabled.' };
      }

      const db = getDb();
      const schema = getSchema();
      const authUserTable = schema.authUser;

      if (!authUserTable) {
        return { success: false, error: 'Database configuration error' };
      }

      // Find user with email auth type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const users = await (db as any)
        .select()
        .from(authUserTable)
        .where(and(
          eq(authUserTable.email, email.toLowerCase()),
          eq(authUserTable.auth_type, 'email_signup')
        ))
        .limit(1);

      if (users.length === 0) {
        return { success: false, error: 'User not found or not eligible for password reset (must have email authentication)' };
      }

      const user = users[0];

      // Check if admin is trying to reset their own password
      if (user.id === adminUserId) {
        return { success: false, error: 'Administrators cannot reset their own password using this endpoint' };
      }

      // Generate reset token
      const token = await this.createResetToken(user.id);

      // Get frontend URL for reset link
      const frontendUrl = await GlobalSettings.get('global.page_url', 'http://localhost:5173');
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
      const supportEmail = await GlobalSettings.get('smtp.from_email') || undefined;

      // Return email data for background job
      return {
        success: true,
        emailData: {
          to: user.email,
          subject: 'Password Reset Initiated by Administrator',
          template: 'admin-password-reset',
          variables: {
            userName: user.username,
            userEmail: user.email,
            resetUrl,
            expirationTime: '10 minutes',
            supportEmail
          }
        }
      };
    } catch (error) {
      if (logger) {
        logger.error({
          error,
          email,
          adminUserId,
          operation: 'prepare_admin_reset_email'
        }, 'Error preparing admin-initiated password reset email');
      }
      return { success: false, error: 'An error occurred while preparing reset email' };
    }
  }

  /**
   * Check if password reset is available (email sending enabled)
   */
  static async isPasswordResetAvailable(): Promise<boolean> {
    return await GlobalSettings.getBoolean('smtp.enabled', false);
  }
}
