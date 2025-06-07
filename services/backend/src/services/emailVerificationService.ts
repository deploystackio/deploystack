import { getDb, getSchema } from '../db';
import { eq, lt, gt } from 'drizzle-orm';
import { generateId } from 'lucia';
import { hash, verify } from '@node-rs/argon2';
import { EmailService } from '../email';
import { GlobalSettings } from '../global-settings/helpers';

export class EmailVerificationService {
  /**
   * Generate a secure verification token
   */
  static generateToken(): string {
    return generateId(32); // 32 character random string
  }

  /**
   * Hash a verification token for secure storage
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
   * Create a verification token for a user
   */
  static async createVerificationToken(userId: string): Promise<string> {
    const db = getDb();
    const schema = getSchema();
    const emailVerificationTokensTable = schema.emailVerificationTokens;

    if (!emailVerificationTokensTable) {
      throw new Error('Email verification tokens table not found');
    }

    // Generate token and hash it
    const token = this.generateToken();
    const tokenHash = await this.hashToken(token);
    
    // Set expiration to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Delete any existing tokens for this user
    await this.deleteUserTokens(userId);

    // Insert new token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).insert(emailVerificationTokensTable).values({
      id: generateId(15),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    return token;
  }

  /**
   * Verify a token and mark user as verified
   */
  static async verifyEmailToken(token: string): Promise<{ success: boolean; error?: string; userId?: string }> {
    const db = getDb();
    const schema = getSchema();
    const emailVerificationTokensTable = schema.emailVerificationTokens;
    const authUserTable = schema.authUser;

    if (!emailVerificationTokensTable || !authUserTable) {
      return { success: false, error: 'Database tables not found' };
    }

    try {
      // Get all non-expired tokens
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokens = await (db as any)
        .select()
        .from(emailVerificationTokensTable)
        .where(gt(emailVerificationTokensTable.expires_at, new Date()));

      // Find matching token
      let matchingToken = null;
      for (const dbToken of tokens) {
        const isValid = await this.verifyToken(token, dbToken.token_hash);
        if (isValid) {
          matchingToken = dbToken;
          break;
        }
      }

      if (!matchingToken) {
        return { success: false, error: 'Invalid or expired verification token' };
      }

      // Mark user as verified
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .update(authUserTable)
        .set({ email_verified: true })
        .where(eq(authUserTable.id, matchingToken.user_id));

      // Delete the used token
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .delete(emailVerificationTokensTable)
        .where(eq(emailVerificationTokensTable.id, matchingToken.id));

      return { success: true, userId: matchingToken.user_id };
    } catch (error) {
      console.error('Error verifying email token:', error);
      return { success: false, error: 'An error occurred during verification' };
    }
  }

  /**
   * Delete all tokens for a user
   */
  static async deleteUserTokens(userId: string): Promise<void> {
    const db = getDb();
    const schema = getSchema();
    const emailVerificationTokensTable = schema.emailVerificationTokens;

    if (!emailVerificationTokensTable) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .delete(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.user_id, userId));
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const db = getDb();
    const schema = getSchema();
    const emailVerificationTokensTable = schema.emailVerificationTokens;

    if (!emailVerificationTokensTable) {
      return 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (db as any)
      .delete(emailVerificationTokensTable)
      .where(lt(emailVerificationTokensTable.expires_at, new Date()));

    return result.changes || 0;
  }

  /**
   * Send verification email to user
   */
  static async sendVerificationEmail(userId: string, userEmail: string, userName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if email sending is enabled
      const isEmailEnabled = await GlobalSettings.getBoolean('global.send_mail', false);
      if (!isEmailEnabled) {
        return { success: false, error: 'Email sending is disabled' };
      }

      // Generate verification token
      const token = await this.createVerificationToken(userId);

      // Get frontend URL for verification link
      const frontendUrl = await GlobalSettings.get('global.page_url', 'http://localhost:5173');
      const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

      // Send verification email
      const emailResult = await EmailService.sendEmail({
        to: userEmail,
        subject: 'Verify Your Email Address',
        template: 'email-verification',
        variables: {
          userName,
          userEmail,
          verificationUrl,
          expirationTime: '24 hours',
          supportEmail: await GlobalSettings.get('smtp.from_email') || undefined,
        },
      });

      if (!emailResult.success) {
        return { success: false, error: emailResult.error || 'Failed to send verification email' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending verification email:', error);
      return { success: false, error: 'An error occurred while sending verification email' };
    }
  }

  /**
   * Check if user's email is verified
   */
  static async isEmailVerified(userId: string): Promise<boolean> {
    const db = getDb();
    const schema = getSchema();
    const authUserTable = schema.authUser;

    if (!authUserTable) {
      return false;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const users = await (db as any)
        .select({ email_verified: authUserTable.email_verified })
        .from(authUserTable)
        .where(eq(authUserTable.id, userId))
        .limit(1);

      return users.length > 0 && users[0].email_verified === true;
    } catch (error) {
      console.error('Error checking email verification status:', error);
      return false;
    }
  }

  /**
   * Check if email verification is required for login
   */
  static async isVerificationRequired(): Promise<boolean> {
    return await GlobalSettings.getBoolean('global.send_mail', false);
  }
}
