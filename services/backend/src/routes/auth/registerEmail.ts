/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { getLucia } from '../../lib/lucia';
import { type RegisterEmailInput } from './schemas';
import { getDb, getSchema } from '../../db';
import { eq, or } from 'drizzle-orm';
import { generateId } from 'lucia'; // Lucia's utility for generating IDs
import { hash } from '@node-rs/argon2';

export default async function registerEmailRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: RegisterEmailInput }>( // Use Fastify's generic type for request body
    '/register/email',
    async (request, reply: FastifyReply) => { // request type will be inferred by Fastify
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
            return reply.status(409).send({ error: 'Username already taken.' });
          }
          const existingUserByEmail = await (db as any).select().from(authUserTable).where(eq(authUserTable.email, email)).limit(1);
          if (existingUserByEmail.length > 0) {
            return reply.status(409).send({ error: 'Email address already in use.' });
          }
        }

        const hashedPassword = await hash(password, {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        });
        const userId = generateId(15); // Generate a 15-character unique ID

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
        });

        const session = await getLucia().createSession(userId, {}); // Empty object for session attributes
        const sessionCookie = getLucia().createSessionCookie(session.id);

        reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
        return reply.status(201).send({ message: 'User registered successfully.' });

      } catch (error) {
        fastify.log.error(error, 'Error during email registration:');
        // Drizzle unique constraint errors might need specific handling if not caught above
        if (error instanceof Error && (error.message.includes('UNIQUE constraint failed: authUser.username') || error.message.includes('Key (username)'))) {
            return reply.status(409).send({ error: 'Username already taken.' });
        }
        if (error instanceof Error && (error.message.includes('UNIQUE constraint failed: authUser.email') || error.message.includes('Key (email)'))) {
            return reply.status(409).send({ error: 'Email address already in use.' });
        }
        return reply.status(500).send({ error: 'An unexpected error occurred during registration.' });
      }
    }
  );
}
