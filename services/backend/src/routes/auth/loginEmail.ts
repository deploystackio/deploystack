import type { FastifyInstance, FastifyReply } from 'fastify';
import { getLucia } from '../../lib/lucia'; // Corrected import
import { type LoginEmailInput } from './schemas';
// argon2 is not directly used here as lucia.useKey handles password verification
import { verify } from '@node-rs/argon2';
import { getDb, getSchema } from '../../db';
import { eq, or } from 'drizzle-orm';

export default async function loginEmailRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: LoginEmailInput }>(
    '/login',
    async (request, reply: FastifyReply) => {
      const { login, password } = request.body;

      // Validate required fields
      if (!login || !password) {
        return reply.status(400).send({ error: 'Email/username and password are required.' });
      }

      try {
        const db = getDb();
        const schema = getSchema();
        const authUserTable = schema.authUser;

        if (!authUserTable) {
          fastify.log.error('AuthUser table not found in schema');
          return reply.status(500).send({ error: 'Internal server error: User table configuration missing.' });
        }

        // Find user by email or username
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const users = await (db as any)
          .select()
          .from(authUserTable)
          .where(or(eq(authUserTable.email, login.toLowerCase()), eq(authUserTable.username, login)))
          .limit(1);

        if (users.length === 0) {
          return reply.status(400).send({ error: 'Invalid email/username or password.' });
        }

        const user = users[0];
        
        // Verify password
        if (!user.hashed_password) {
          return reply.status(400).send({ error: 'Invalid email/username or password.' });
        }

        const validPassword = await verify(user.hashed_password, password, {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        });

        if (!validPassword) {
          return reply.status(400).send({ error: 'Invalid email/username or password.' });
        }

        // Check if user ID exists
        if (!user.id) {
          fastify.log.error('User ID is null or undefined:', user.id);
          return reply.status(500).send({ error: 'User ID not found.' });
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
        return reply.status(200).send({ message: 'Logged in successfully.' });

      } catch (error) {
        fastify.log.error(error, 'Error during email login:');
        return reply.status(500).send({ error: 'An unexpected error occurred during login.' });
      }
    }
  );
}
