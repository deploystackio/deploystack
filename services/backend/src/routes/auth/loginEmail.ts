import type { FastifyInstance, FastifyReply } from 'fastify';
import { getLucia } from '../../lib/lucia'; // Corrected import
// argon2 is not directly used here as lucia.useKey handles password verification
import { verify } from '@node-rs/argon2';
import { getDb, getSchema } from '../../db';
import { eq, or } from 'drizzle-orm';
import { GlobalSettingsInitService } from '../../global-settings';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

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
  description: "Authenticates a user using their registered identifier (email or username) and password. This endpoint is accessed via the /api/auth/email/login path due to server-level prefixing. Establishes a session by setting an authentication cookie.",
  body: zodToJsonSchema(loginEmailBodySchema, { $refStrategy: 'none', target: 'openApi3' }),
  response: {
    200: zodToJsonSchema(successResponseSchema.describe('Login successful. Session cookie is set.'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Invalid input or invalid credentials.'), {
      $refStrategy: 'none',
      target: 'openApi3',
      // examples: [
      //   { success: false, error: "Email/username and password are required." },
      //   { success: false, error: "Invalid email/username or password." }
      // ]
    }),
    403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Login is disabled by administrator.'), {
      $refStrategy: 'none',
      target: 'openApi3',
      // examples: [
      //   { success: false, error: "Login is currently disabled by administrator." }
      // ]
    }),
    500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error - An unexpected error occurred on the server.'), {
      $refStrategy: 'none',
      target: 'openApi3',
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
        return reply.status(403).send({ 
          success: false, 
          error: 'Login is currently disabled by administrator.' 
        });
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
          return reply.status(500).send({ success: false, error: 'Internal server error: User table configuration missing.' });
        }

        // Find user by email or username
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const users = await (db as any)
          .select()
          .from(authUserTable)
          .where(or(eq(authUserTable.email, login.toLowerCase()), eq(authUserTable.username, login)))
          .limit(1);

        if (users.length === 0) {
          return reply.status(400).send({ success: false, error: 'Invalid email/username or password.' });
        }

        const user = users[0];
        
        // Verify password
        if (!user.hashed_password) {
          return reply.status(400).send({ success: false, error: 'Invalid email/username or password.' });
        }

        const validPassword = await verify(user.hashed_password, password, {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        });

        if (!validPassword) {
          return reply.status(400).send({ success: false, error: 'Invalid email/username or password.' });
        }

        // Check if user ID exists
        if (!user.id) {
          fastify.log.error('User ID is null or undefined:', user.id);
          return reply.status(500).send({ success: false, error: 'User ID not found.' });
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
        return reply.status(200).send({
          success: true,
          message: 'Logged in successfully.',
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            role_id: user.role_id
          }
        });

      } catch (error) {
        fastify.log.error(error, 'Error during email login:');
        return reply.status(500).send({ success: false, error: 'An unexpected error occurred during login.' });
      }
    }
  );
}
