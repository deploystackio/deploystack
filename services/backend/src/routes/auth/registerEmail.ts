/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyReply } from 'fastify';

import { RegisterEmailSchema, type RegisterEmailInput } from './schemas';
import { getDb, getSchema } from '../../db';
import { eq, or } from 'drizzle-orm';
import { generateId } from 'lucia'; // Lucia's utility for generating IDs
import { hash } from '@node-rs/argon2';
import { TeamService } from '../../services/teamService';
import { GlobalSettingsInitService } from '../../global-settings';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Response schemas
const userResponseSchema = z.object({
  id: z.string().describe('User ID'),
  username: z.string().describe("User's username"),
  email: z.string().email().describe("User's email address"),
  first_name: z.string().nullable().describe("User's first name"),
  last_name: z.string().nullable().describe("User's last name"),
  role_id: z.string().describe("User's role ID")
});

const registerSuccessResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the registration was successful'),
  message: z.string().describe('Success message'),
  user: userResponseSchema.describe('Information about the registered user')
});

const registerErrorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message describing what went wrong')
});

// Route schema for OpenAPI documentation
const registerEmailRouteSchema = {
  tags: ['Authentication'],
  summary: 'User registration via email',
  description: 'Creates a new user account using email and password. The first registered user automatically becomes a global administrator. Automatically creates a session and default team for the user.',
  body: zodToJsonSchema(RegisterEmailSchema, { 
    $refStrategy: 'none', 
    target: 'openApi3' 
  }),
  response: {
    201: zodToJsonSchema(registerSuccessResponseSchema.describe('User registered successfully'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    400: zodToJsonSchema(registerErrorResponseSchema.describe('Bad Request - Invalid input, username taken, or email already in use'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    403: zodToJsonSchema(registerErrorResponseSchema.describe('Forbidden - Email registration is disabled by administrator'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    500: zodToJsonSchema(registerErrorResponseSchema.describe('Internal Server Error - Registration failed'), {
      $refStrategy: 'none',
      target: 'openApi3'
    })
  }
};

export default async function registerEmailRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: RegisterEmailInput }>( // Use Fastify's generic type for request body
    '/register',
    { schema: registerEmailRouteSchema },
    async (request, reply: FastifyReply) => { // request type will be inferred by Fastify
      // Check if email registration is enabled
      const isEmailRegistrationEnabled = await GlobalSettingsInitService.isEmailRegistrationEnabled();
      if (!isEmailRegistrationEnabled) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Email registration is currently disabled by administrator.' 
        });
      }

      const { username, email, password, first_name, last_name } = request.body; // request.body should now be typed as RegisterEmailInput

      const db = getDb();
      const schema = getSchema();
      const authUserTable = schema.authUser; // Get the Drizzle table object

      if (!authUserTable) {
        fastify.log.error('AuthUser table not found in schema');
        return reply.status(500).send({ error: 'Internal server error: User table configuration missing.' });
      }

      try {
        // Check if username or email already exists
        const existingUsers = await (db as any)
          .select()
          .from(authUserTable)
          .where(or(eq(authUserTable.username, username), eq(authUserTable.email, email)))
          .limit(1);

        if (existingUsers.length > 0) {
          // Determine if username or email caused the conflict for a more specific message
          const existingUserByUsername = await (db as any).select().from(authUserTable).where(eq(authUserTable.username, username)).limit(1);
          if (existingUserByUsername.length > 0) {
            return reply.status(400).send({ success: false, error: 'Username already taken.' });
          }
          const existingUserByEmail = await (db as any).select().from(authUserTable).where(eq(authUserTable.email, email)).limit(1);
          if (existingUserByEmail.length > 0) {
            return reply.status(400).send({ success: false, error: 'Email address already in use.' });
          }
        }

        const hashedPassword = await hash(password, {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        });
        const userId = generateId(15); // Generate a 15-character unique ID

        // Check if this is the first user (will become global_admin)
        const allUsers = await (db as any).select().from(authUserTable).limit(1);
        const isFirstUser = allUsers.length === 0;
        const defaultRole = isFirstUser ? 'global_admin' : 'global_user';

        // For first user (global_admin), email is automatically verified
        // For subsequent users, email verification depends on global.send_mail setting
        const emailVerified = isFirstUser;

        // Insert user directly into database (Lucia v3 doesn't have createUser with keys)
        await (db as any).insert(authUserTable).values({
          id: userId,
          username,
          email: email.toLowerCase(),
          auth_type: 'email_signup',
          first_name: first_name || null,
          last_name: last_name || null,
          github_id: null,
          hashed_password: hashedPassword, // Store password in user table
          role_id: defaultRole, // Assign role (no default in schema, so we must provide it)
          email_verified: emailVerified, // Set email verification status
        });

        // Verify user was created successfully
        const createdUser = await (db as any)
          .select()
          .from(authUserTable)
          .where(eq(authUserTable.id, userId))
          .limit(1);

        if (createdUser.length === 0) {
          fastify.log.error('User creation failed - user not found after insert');
          return reply.status(500).send({ error: 'User creation failed.' });
        }

        fastify.log.info(`User created successfully: ${userId} with role: ${defaultRole}`);

        // Create session for the user
        const sessionId = generateId(40); // Generate session ID
        const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
        
        const authSessionTable = schema.authSession;
        
        // Insert session directly into database
        await (db as any).insert(authSessionTable).values({
          id: sessionId,
          user_id: userId,
          expires_at: expiresAt
        });
        
        fastify.log.info(`Session created successfully for user: ${userId}`);
        
        // Import lucia and create session cookie
        const { getLucia } = await import('../../lib/lucia');
        const sessionCookie = getLucia().createSessionCookie(sessionId);
        reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

        // Create default team for the user
        try {
          const team = await TeamService.createDefaultTeamForUser(userId, username);
          fastify.log.info(`Default team created successfully for user ${userId}: ${team.id}`);
        } catch (teamError) {
          fastify.log.error(teamError, `Failed to create default team for user ${userId}:`);
          // Don't fail registration if team creation fails, just log the error
        }

        // Send verification email for non-first users when email sending is enabled
        if (!isFirstUser) {
          try {
            const { EmailVerificationService } = await import('../../services/emailVerificationService');
            const isEmailEnabled = await EmailVerificationService.isVerificationRequired();
            
            if (isEmailEnabled) {
              const emailResult = await EmailVerificationService.sendVerificationEmail(
                userId,
                email.toLowerCase(),
                username
              );
              
              if (!emailResult.success) {
                fastify.log.warn(`Failed to send verification email to ${email}: ${emailResult.error}`);
                // Don't fail registration if email sending fails
              } else {
                fastify.log.info(`Verification email sent successfully to ${email}`);
              }
            }
          } catch (emailError) {
            fastify.log.error(emailError, `Error sending verification email to ${email}:`);
            // Don't fail registration if email sending fails
          }
        }

        // Get the created user data
        const user = createdUser[0];

        // Customize message based on email verification status
        let message = 'User registered successfully.';
        if (isFirstUser) {
          message += ' You are now logged in as the global administrator.';
        } else {
          try {
            const { EmailVerificationService } = await import('../../services/emailVerificationService');
            const isEmailEnabled = await EmailVerificationService.isVerificationRequired();
            if (isEmailEnabled) {
              message += ' Please check your email and verify your address before logging in.';
            } else {
              message += ' You can now log in to your account.';
            }
          } catch {
            message += ' You can now log in to your account.';
          }
        }

        return reply.status(201).send({
          success: true,
          message,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role_id: user.role_id
          }
        });

      } catch (error) {
        fastify.log.error(error, 'Error during email registration:');
        // Drizzle unique constraint errors might need specific handling if not caught above
        if (error instanceof Error && (error.message.includes('UNIQUE constraint failed: authUser.username') || error.message.includes('Key (username)'))) {
            return reply.status(400).send({ success: false, error: 'Username already taken.' });
        }
        if (error instanceof Error && (error.message.includes('UNIQUE constraint failed: authUser.email') || error.message.includes('Key (email)'))) {
            return reply.status(400).send({ success: false, error: 'Email address already in use.' });
        }
        return reply.status(500).send({ success: false, error: 'An unexpected error occurred during registration.' });
      }
    }
  );
}
