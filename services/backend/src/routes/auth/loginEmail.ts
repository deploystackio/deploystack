import type { FastifyInstance, FastifyReply } from 'fastify';
import { getLucia } from '../../lib/lucia'; // Corrected import
// argon2 is not directly used here as lucia.useKey handles password verification
import { verify } from '@node-rs/argon2';
import { getDb, getSchema } from '../../db';
import { eq, or } from 'drizzle-orm';
import { GlobalSettingsInitService } from '../../global-settings';

const loginEmailRouteSchema = {
  tags: ['Authentication'],
  summary: 'User login via email/password',
  description: "Authenticates a user using their registered identifier (email or username) and password. This endpoint is accessed via the /api/auth/email/login path due to server-level prefixing. Establishes a session by setting an authentication cookie.",
  body: {
    type: 'object',
    properties: {
      login: {
        type: 'string',
        description: "User's registered email address or username."
      },
      password: {
        type: 'string',
        description: "User's password."
      }
    },
    required: ['login', 'password']
  },
  response: {
    200: {
      description: 'Login successful. Session cookie is set.',
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Indicates if the login operation was successful.' },
        message: { type: 'string', description: 'Human-readable message about the login result.' },
        user: {
          type: 'object',
          description: 'Basic information about the logged-in user.',
          properties: {
            id: { type: 'string', description: 'User ID' },
            email: { type: 'string', format: 'email', description: "User's primary email address." },
            username: { type: 'string', nullable: true },
            first_name: { type: 'string', nullable: true },
            last_name: { type: 'string', nullable: true },
            role_id: { type: 'string', nullable: true }
          },
          required: ['id', 'email']
        }
      },
      required: ['success', 'message', 'user'],
      examples: [
        {
          success: true,
          message: "Logged in successfully.",
          user: {
            id: "clxyz1234000008l3abcde123",
            email: "user@example.com",
            username: "testuser",
            first_name: "Test",
            last_name: "User",
            role_id: "user_role_id"
          }
        }
      ]
    },
    400: {
      description: 'Bad Request - Invalid input or invalid credentials.',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string', description: 'Error message.' }
      },
      required: ['success', 'error'],
      examples: [
        { success: false, error: "Email/username and password are required." },
        { success: false, error: "Invalid email/username or password." }
      ]
    },
    403: {
      description: 'Forbidden - Login is disabled by administrator.',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' }
      },
      required: ['success', 'error'],
      examples: [
        { success: false, error: "Login is currently disabled by administrator." }
      ]
    },
    500: {
      description: 'Internal Server Error - An unexpected error occurred on the server.',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' }
      },
      required: ['success', 'error'],
      examples: [
        { success: false, error: "An unexpected error occurred during login." },
        { success: false, error: "Internal server error: User table configuration missing." },
        { success: false, error: "User ID not found." }
      ]
    }
  },
  security: [{ cookieAuth: [] }]
};

export default async function loginEmailRoute(fastify: FastifyInstance) {
  fastify.post(
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { login, email, password } = request.body as any;
      
      // Support both 'login' field (schema) and 'email' field (for backward compatibility with tests)
      const loginValue = login || email;

      // Validate required fields
      if (!loginValue || !password) {
        return reply.status(400).send({ success: false, error: 'Email/username and password are required.' });
      }

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
          .where(or(eq(authUserTable.email, loginValue.toLowerCase()), eq(authUserTable.username, loginValue)))
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
            username: user.username,
            email: user.email,
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
