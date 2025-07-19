import type { FastifyInstance, FastifyReply } from 'fastify';
import { getLucia } from '../../lib/lucia'; // Corrected import
// argon2 is not directly used here as lucia.useKey handles password verification
import { verify } from '@node-rs/argon2';
import { getDb, getSchema } from '../../db';
import { eq, or } from 'drizzle-orm';
import { GlobalSettingsInitService } from '../../global-settings';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';

// Zod Schemas
const loginEmailBodySchema = z.object({
  login: z.string().describe("User's registered email address or username."),
  password: z.string().describe("User's password.")
});

const userResponseSchema = z.object({
  id: z.string().describe('User ID'),
  email: z.string().email().describe("User's primary email address."),
  username: z.string().optional().nullable().describe("User's username."),
  first_name: z.string().optional().nullable().describe("User's first name."),
  last_name: z.string().optional().nullable().describe("User's last name."),
  role_id: z.string().optional().nullable().describe("User's role ID.")
});

const successResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the login operation was successful.'),
  message: z.string().describe('Human-readable message about the login result.'),
  user: userResponseSchema.describe('Basic information about the logged-in user.')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (typically false for errors).').default(false),
  error: z.string().describe('Error message.')
});

const loginEmailRouteSchema = {
  tags: ['Authentication'],
  summary: 'User login via email/password',
  description: "Authenticates a user using their registered identifier (email or username) and password. This endpoint is accessed via the /api/auth/email/login path due to server-level prefixing. Establishes a session by setting an authentication cookie. Requires Content-Type: application/json header when sending request body.",
  body: {
    type: 'object',
    properties: {
      login: { type: 'string', minLength: 1 },
      password: { type: 'string', minLength: 1 }
    },
    required: ['login', 'password'],
    additionalProperties: false
  },
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: createSchema(loginEmailBodySchema)
      }
    }
  },
  response: {
    200: createSchema(successResponseSchema.describe('Login successful. Session cookie is set.')),
    400: createSchema(errorResponseSchema.describe('Bad Request - Invalid input, invalid credentials, or missing Content-Type header.'), {
      // examples: [
      //   { success: false, error: "Email/username and password are required." },
      //   { success: false, error: "Invalid email/username or password." }
      // ]
    }),
    403: createSchema(errorResponseSchema.describe('Forbidden - Login is disabled by administrator.'), {
      // examples: [
      //   { success: false, error: "Login is currently disabled by administrator." }
      // ]
    }),
    500: createSchema(errorResponseSchema.describe('Internal Server Error - An unexpected error occurred on the server.'), {
      // examples: [
      //   { success: false, error: "An unexpected error occurred during login." },
      //   { success: false, error: "Internal server error: User table configuration missing." },
      //   { success: false, error: "User ID not found." }
      // ]
    })
  },
  security: [{ cookieAuth: [] }]
};

export default async function loginEmailRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: { login: string; password: string } }>(
    '/login',
    { schema: loginEmailRouteSchema },
    async (request, reply: FastifyReply) => {
      // Check if login is enabled
      const isLoginEnabled = await GlobalSettingsInitService.isLoginEnabled();
      if (!isLoginEnabled) {
        const errorResponse = {
          success: false,
          error: 'Login is currently disabled by administrator.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Fastify has already validated the request body using our Zod schema
      // If we reach here, request.body is guaranteed to be valid with required fields
      const { login, password } = request.body;

      try {
        const db = getDb();
        const schema = getSchema();
        const authUserTable = schema.authUser;

        if (!authUserTable) {
          fastify.log.error('AuthUser table not found in schema');
          const errorResponse = {
            success: false,
            error: 'Internal server error: User table configuration missing.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(500).type('application/json').send(jsonString);
        }

        // Find user by email or username
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const users = await (db as any)
          .select()
          .from(authUserTable)
          .where(or(eq(authUserTable.email, login.toLowerCase()), eq(authUserTable.username, login)))
          .limit(1);

        if (users.length === 0) {
          const errorResponse = {
            success: false,
            error: 'Invalid email/username or password.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        const user = users[0];
        
        // Verify password
        if (!user.hashed_password) {
          const errorResponse = {
            success: false,
            error: 'Invalid email/username or password.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        const validPassword = await verify(user.hashed_password, password, {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1
        });

        if (!validPassword) {
          const errorResponse = {
            success: false,
            error: 'Invalid email/username or password.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        // Check email verification status for email users when verification is required
        if (user.auth_type === 'email_signup') {
          try {
            const { EmailVerificationService } = await import('../../services/emailVerificationService');
            const isVerificationRequired = await EmailVerificationService.isVerificationRequired();
            
            if (isVerificationRequired && !user.email_verified) {
              const errorResponse = {
                success: false,
                error: 'Please verify your email address before logging in. Check your inbox for a verification email.'
              };
              const jsonString = JSON.stringify(errorResponse);
              return reply.status(400).type('application/json').send(jsonString);
            }
          } catch (verificationError) {
            fastify.log.error(verificationError, 'Error checking email verification status:');
            // Continue with login if verification check fails
          }
        }

        // Check if user ID exists
        if (!user.id) {
          fastify.log.error('User ID is null or undefined:', user.id);
          const errorResponse = {
            success: false,
            error: 'User ID not found.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(500).type('application/json').send(jsonString);
        }
        
        // Use manual session creation like in registration to avoid Lucia adapter issues
        const { generateId } = await import('lucia');
        const sessionId = generateId(40); // Generate session ID
        const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
        
        const authSessionTable = schema.authSession;
        
        // Insert session directly into database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).insert(authSessionTable).values({
          id: sessionId,
          user_id: user.id,
          expires_at: expiresAt
        });
        
        fastify.log.info(`Session created successfully for user: ${user.id}`);
        
        const sessionCookie = getLucia().createSessionCookie(sessionId);

        reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
        
        // Create clean response object to avoid serialization issues
        const cleanResponse = {
          success: true,
          message: 'Logged in successfully.',
          user: {
            id: String(user.id),
            email: String(user.email),
            username: user.username ? String(user.username) : null,
            first_name: user.first_name ? String(user.first_name) : null,
            last_name: user.last_name ? String(user.last_name) : null,
            role_id: String(user.role_id)
          }
        };
        
        // Send as raw JSON string to bypass any serialization issues
        const jsonString = JSON.stringify(cleanResponse);
        fastify.log.info('Sending login response:', jsonString);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        fastify.log.error(error, 'Error during email login:');
        const errorResponse = {
          success: false,
          error: 'An unexpected error occurred during login.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
