import type { FastifyInstance, FastifyReply } from 'fastify';
import { getLucia } from '../../lib/lucia';
import { verify } from '@node-rs/argon2';
import { getDb, getSchema } from '../../db';
import { eq, or } from 'drizzle-orm';
import { GlobalSettingsInitService } from '../../global-settings';

// Reusable Schema Constants
const LOGIN_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    login: { 
      type: 'string', 
      minLength: 1,
      description: "User's registered email address or username"
    },
    password: { 
      type: 'string', 
      minLength: 1,
      description: "User's password"
    }
  },
  required: ['login', 'password'],
  additionalProperties: false
} as const;

const USER_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: { 
      type: 'string',
      description: 'User ID'
    },
    email: { 
      type: 'string',
      format: 'email',
      description: "User's primary email address"
    },
    username: { 
      type: 'string',
      nullable: true,
      description: "User's username"
    },
    first_name: { 
      type: 'string',
      nullable: true,
      description: "User's first name"
    },
    last_name: { 
      type: 'string',
      nullable: true,
      description: "User's last name"
    },
    role_id: { 
      type: 'string',
      nullable: true,
      description: "User's role ID"
    }
  },
  required: ['id', 'email']
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the login operation was successful'
    },
    message: { 
      type: 'string',
      description: 'Human-readable message about the login result'
    },
    user: USER_RESPONSE_SCHEMA
  },
  required: ['success', 'message', 'user']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      default: false,
      description: 'Indicates the operation failed'
    },
    error: { 
      type: 'string',
      description: 'Error message describing what went wrong'
    }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces for type safety
interface LoginRequest {
  login: string;
  password: string;
}

interface UserResponse {
  id: string;
  email: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  role_id: string | null;
}

interface LoginSuccessResponse {
  success: boolean;
  message: string;
  user: UserResponse;
}

interface LoginErrorResponse {
  success: boolean;
  error: string;
}

const loginEmailRouteSchema = {
  tags: ['Authentication'],
  summary: 'User login via email/password',
  description: "Authenticates a user using their registered identifier (email or username) and password. This endpoint is accessed via the /api/auth/email/login path due to server-level prefixing. Establishes a session by setting an authentication cookie. Requires Content-Type: application/json header when sending request body.",
  
  // Fastify validation schema
  body: LOGIN_REQUEST_SCHEMA,
  
  // OpenAPI documentation (same schema, reused)
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: LOGIN_REQUEST_SCHEMA
      }
    }
  },
  
  response: {
    200: {
      ...SUCCESS_RESPONSE_SCHEMA,
      description: 'Login successful. Session cookie is set.'
    },
    400: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Bad Request - Invalid input, invalid credentials, or missing Content-Type header'
    },
    403: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Forbidden - Login is disabled by administrator'
    },
    500: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Internal Server Error - An unexpected error occurred on the server'
    }
  }
};

export default async function loginEmailRoute(server: FastifyInstance) {
  server.post('/login', {
    schema: loginEmailRouteSchema
  }, async (request, reply: FastifyReply) => {
      // Check if login is enabled
      const isLoginEnabled = await GlobalSettingsInitService.isLoginEnabled();
      if (!isLoginEnabled) {
        const errorResponse: LoginErrorResponse = {
          success: false,
          error: 'Login is currently disabled by administrator.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Fastify has already validated the request body using our JSON schema
      // If we reach here, request.body is guaranteed to be valid with required fields
      const { login, password } = request.body as LoginRequest;

      try {
        const db = getDb();
        const schema = getSchema();
        const authUserTable = schema.authUser;

        if (!authUserTable) {
          server.log.error('AuthUser table not found in schema');
          const errorResponse: LoginErrorResponse = {
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
          const errorResponse: LoginErrorResponse = {
            success: false,
            error: 'Invalid email/username or password.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        const user = users[0];
        
        // Verify password
        if (!user.hashed_password) {
          const errorResponse: LoginErrorResponse = {
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
          const errorResponse: LoginErrorResponse = {
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
              const errorResponse: LoginErrorResponse = {
                success: false,
                error: 'Please verify your email address before logging in. Check your inbox for a verification email.'
              };
              const jsonString = JSON.stringify(errorResponse);
              return reply.status(400).type('application/json').send(jsonString);
            }
          } catch (verificationError) {
            server.log.error(verificationError, 'Error checking email verification status:');
            // Continue with login if verification check fails
          }
        }

        // Check if user ID exists
        if (!user.id) {
          server.log.error('User ID is null or undefined:', user.id);
          const errorResponse: LoginErrorResponse = {
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
        
        server.log.info(`Session created successfully for user: ${user.id}`);
        
        const sessionCookie = getLucia().createSessionCookie(sessionId);

        reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
        
        // Create clean response object to avoid serialization issues
        const cleanResponse: LoginSuccessResponse = {
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
        server.log.info('Sending login response:', jsonString);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        server.log.error(error, 'Error during email login:');
        const errorResponse: LoginErrorResponse = {
          success: false,
          error: 'An unexpected error occurred during login.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
