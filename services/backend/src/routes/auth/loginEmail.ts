import type { FastifyInstance, FastifyReply } from 'fastify';
import { getLucia } from '../../lib/lucia'; // Corrected import
import { LoginEmailSchema, type LoginEmailInput } from './schemas';
// argon2 is not directly used here as lucia.useKey handles password verification
import { verify } from '@node-rs/argon2';
import { getDb, getSchema } from '../../db';
import { eq, or } from 'drizzle-orm';

export default async function loginEmailRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: LoginEmailInput }>(
    '/login/email',
    async (request, reply: FastifyReply) => {
      const { login, password } = request.body;

      try {
        const db = getDb();
        const schema = getSchema();
        const authUserTable = schema.authUser;

        if (!authUserTable) {
          fastify.log.error('AuthUser table not found in schema');
          return reply.status(500).send({ error: 'Internal server error: User table configuration missing.' });
        }

        // Find user by email or username
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

        const session = await getLucia().createSession(user.id, {});
        const sessionCookie = getLucia().createSessionCookie(session.id);

        reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
        return reply.status(200).send({ message: 'Logged in successfully.' });

      } catch (error) {
        fastify.log.error(error, 'Error during email login:');
        return reply.status(500).send({ error: 'An unexpected error occurred during login.' });
      }
    }
  );
}
