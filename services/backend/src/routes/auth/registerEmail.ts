/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance } from 'fastify';
import { getDb, getSchema } from '../../db';
import { eq } from 'drizzle-orm';
import { generateId } from 'lucia';
import { hash } from '@node-rs/argon2';
import { TeamService } from '../../services/teamService';
import { GlobalSettingsInitService } from '../../global-settings';
import { UserPreferencesService } from '../../services/UserPreferencesService';
import { EVENT_NAMES } from '../../events';
import type { EventContext } from '../../events/types';

// Reusable Schema Constants
const REGISTER_EMAIL_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      minLength: 3,
      maxLength: 50,
      pattern: '^[a-zA-Z0-9_-]+$',
      description: 'Username (3-50 characters, alphanumeric, underscore, hyphen only)'
    },
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255,
      description: 'Valid email address'
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
      description: 'Password (minimum 8 characters)'
    },
    first_name: {
      type: 'string',
      maxLength: 100,
      description: 'First name (optional)'
    },
    last_name: {
      type: 'string',
      maxLength: 100,
      description: 'Last name (optional)'
    }
  },
  required: ['username', 'email', 'password'],
  additionalProperties: false
} as const;

const USER_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'User ID'
    },
    username: {
      type: 'string',
      description: "User's username"
    },
    email: {
      type: 'string',
      format: 'email',
      description: "User's email address"
    },
    first_name: {
      type: ['string', 'null'],
      description: "User's first name"
    },
    last_name: {
      type: ['string', 'null'],
      description: "User's last name"
    },
    role_id: {
      type: 'string',
      description: "User's role ID"
    }
  },
  required: ['id', 'username', 'email', 'first_name', 'last_name', 'role_id']
} as const;

const REGISTER_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates if the registration was successful'
    },
    message: {
      type: 'string',
      description: 'Success message'
    },
    user: {
      ...USER_RESPONSE_SCHEMA,
      description: 'Information about the registered user'
    }
  },
  required: ['success', 'message', 'user']
} as const;

const REGISTER_ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      default: false,
      description: 'Indicates if the operation was successful (false for errors)'
    },
    error: {
      type: 'string',
      description: 'Error message describing what went wrong'
    }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces for type safety
interface RegisterEmailRequest {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

interface UserResponse {
  id: string;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_id: string;
}

interface RegisterSuccessResponse {
  success: boolean;
  message: string;
  user: UserResponse;
}

interface RegisterErrorResponse {
  success: boolean;
  error: string;
}

export default async function registerEmailRoute(server: FastifyInstance) {
  server.post('/register', {
    // No preValidation - this is a public endpoint
    schema: {
      tags: ['Authentication'],
      summary: 'User registration via email',
      description: 'Creates a new user account using email and password. The first registered user automatically becomes a global administrator. Automatically creates a session and default team for the user. Requires Content-Type: application/json header when sending request body.',
      
      // Fastify validation schema
      body: REGISTER_EMAIL_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: REGISTER_EMAIL_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        201: {
          ...REGISTER_SUCCESS_RESPONSE_SCHEMA,
          description: 'User registered successfully'
        },
        400: {
          ...REGISTER_ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid input, email already in use, or missing Content-Type header'
        },
        403: {
          ...REGISTER_ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Email registration is disabled by administrator'
        },
        500: {
          ...REGISTER_ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error - Registration failed'
        }
      }
    }
  }, async (request, reply) => {
        // Check if email registration is enabled
        const isEmailRegistrationEnabled = await GlobalSettingsInitService.isEmailRegistrationEnabled();
        if (!isEmailRegistrationEnabled) {
          const errorResponse: RegisterErrorResponse = {
            success: false,
            error: 'Email registration is currently disabled by administrator.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(403).type('application/json').send(jsonString);
        }

      // TypeScript type assertion (Fastify has already validated)
      const { username, email, password, first_name, last_name } = request.body as RegisterEmailRequest;

      const db = getDb();
      const schema = getSchema();
      const authUserTable = schema.authUser; // Get the Drizzle table object

        if (!authUserTable) {
          server.log.error('AuthUser table not found in schema');
          const errorResponse: RegisterErrorResponse = {
            success: false,
            error: 'Internal server error: User table configuration missing.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(500).type('application/json').send(jsonString);
        }

      try {
        // Check if email already exists
        const existingUsers = await (db as any)
          .select()
          .from(authUserTable)
          .where(eq(authUserTable.email, email))
          .limit(1);

        if (existingUsers.length > 0) {
          const errorResponse: RegisterErrorResponse = {
            success: false,
            error: 'Email address already in use.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
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
        // For subsequent users, email verification depends on smtp.enabled setting
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
          server.log.error('User creation failed - user not found after insert');
          const errorResponse: RegisterErrorResponse = {
            success: false,
            error: 'User creation failed.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(500).type('application/json').send(jsonString);
        }

        server.log.info(`User created successfully: ${userId} with role: ${defaultRole}`);

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
        
        server.log.info(`Session created successfully for user: ${userId}`);
        
        // Import lucia and create session cookie
        const { getLucia } = await import('../../lib/lucia');
        const sessionCookie = getLucia().createSessionCookie(sessionId);
        reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

        // Create default team for the user
        try {
          const team = await TeamService.createDefaultTeamForUser(userId, username, server.log);
          server.log.info(`Default team created successfully for user ${userId}: ${team.id}`);
        } catch (teamError) {
          server.log.error(teamError, `Failed to create default team for user ${userId}:`);
          // Don't fail registration if team creation fails, just log the error
        }

        // Initialize default user preferences
        try {
          const preferencesService = new UserPreferencesService(db);
          await preferencesService.initializeUserPreferences(userId);
          server.log.info(`Default preferences initialized successfully for user ${userId}`);
        } catch (preferencesError) {
          server.log.error(preferencesError, `Failed to initialize preferences for user ${userId}:`);
          // Don't fail registration if preferences initialization fails, just log the error
        }

        // Queue verification email for non-first users when email sending is enabled
        if (!isFirstUser) {
          try {
            const { EmailVerificationService } = await import('../../services/emailVerificationService');
            const isEmailEnabled = await EmailVerificationService.isVerificationRequired();
            
            if (isEmailEnabled) {
              // Generate verification token
              const token = await EmailVerificationService.createVerificationToken(userId);
              
              // Get frontend URL for verification link
              const { GlobalSettings } = await import('../../global-settings/helpers');
              const frontendUrl = await GlobalSettings.get('global.page_url', 'http://localhost:5173');
              const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
              const supportEmail = await GlobalSettings.get('smtp.from_email') || undefined;
              
              // Queue email as background job
              const jobQueueService = (server as any).jobQueueService;
              if (jobQueueService) {
                await jobQueueService.createJob('send_email', {
                  to: email.toLowerCase(),
                  subject: 'Verify Your Email Address',
                  template: 'email-verification',
                  variables: {
                    userName: username,
                    userEmail: email.toLowerCase(),
                    verificationUrl,
                    expirationTime: '24 hours',
                    supportEmail
                  }
                });
                server.log.info(`Verification email queued for ${email}`);
              } else {
                server.log.warn('Job queue service not available, skipping verification email');
              }
            }
          } catch (emailError) {
            server.log.error(emailError, `Error queueing verification email for ${email}:`);
            // Don't fail registration if email queueing fails
          }
        }

        // Get the created user data
        const user = createdUser[0];

        // Emit USER_REGISTERED event
        try {
          const eventContext: EventContext = {
            db,
            logger: server.log,
            user: {
              id: user.id,
              email: user.email,
              roleId: user.role_id
            },
            request: {
              ip: request.ip,
              userAgent: request.headers['user-agent'],
              requestId: request.id
            },
            timestamp: new Date()
          };

          server.eventBus.emitWithContext(
            EVENT_NAMES.USER_REGISTERED,
            {
              user: {
                id: user.id,
                email: user.email,
                name: user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
                createdAt: new Date()
              },
              metadata: {
                registrationMethod: 'email',
                ip: request.ip,
                userAgent: request.headers['user-agent']
              }
            },
            eventContext
          );
          server.log.info(`USER_REGISTERED event emitted for user: ${user.id}`);
        } catch (eventError) {
          server.log.error(eventError, `Failed to emit USER_REGISTERED event for user ${user.id}:`);
          // Don't fail registration if event emission fails
        }

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

        // Create typed response object
        const successResponse: RegisterSuccessResponse = {
          success: true,
          message: message,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role_id: user.role_id
          }
        };
        
        const jsonString = JSON.stringify(successResponse);
        server.log.info({ response: jsonString }, 'Sending registration response:');
        return reply.status(201).type('application/json').send(jsonString);

      } catch (error) {
        server.log.error(error, 'Error during email registration:');
        // Drizzle unique constraint errors might need specific handling if not caught above
        if (error instanceof Error && (error.message.includes('UNIQUE constraint failed: authUser.email') || error.message.includes('Key (email)'))) {
          const errorResponse: RegisterErrorResponse = {
            success: false,
            error: 'Email address already in use.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
        const errorResponse: RegisterErrorResponse = {
          success: false,
          error: 'An unexpected error occurred during registration.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
