import type { FastifyRequest, FastifyReply } from 'fastify';
import { getLucia } from '../lib/lucia';
import { getDbStatus, getSchema, getDb } from '../db';
import { eq } from 'drizzle-orm';
import type { User, Session } from 'lucia';

// Augment FastifyRequest to include user and session
declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
    session: Session | null;
  }
}

export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply
  // No done: HookHandlerDoneFunction needed if the hook doesn't explicitly call done()
) {
  // Check if database is configured before attempting authentication
  const dbStatus = getDbStatus();
  if (!dbStatus.configured || !dbStatus.initialized) {
    // Database not ready, skip authentication
    request.user = null;
    request.session = null;
    return;
  }

  try {
    const lucia = getLucia();
    const sessionId = lucia.readSessionCookie(request.headers.cookie ?? '');
    
    if (!sessionId) {
      request.log.debug('Auth hook: No session cookie found');
      request.user = null;
      request.session = null;
      return; // Proceed as unauthenticated
    }

    request.log.debug(`Auth hook: Found session ID: ${sessionId}`);
    
    // Manual session validation to avoid Lucia SQL syntax issues
    const db = getDb();
    const schema = getSchema();
    const authSessionTable = schema.authSession;
    const authUserTable = schema.authUser;
    
    if (!authSessionTable || !authUserTable) {
      request.log.error('Auth tables not found in schema');
      request.user = null;
      request.session = null;
      return;
    }
    
    // Query session and user manually
    const sessionResult = await db.select({
      sessionId: authSessionTable.id,
      userId: authSessionTable.user_id,
      expiresAt: authSessionTable.expires_at,
      username: authUserTable.username,
      email: authUserTable.email,
      firstName: authUserTable.first_name,
      lastName: authUserTable.last_name,
      authType: authUserTable.auth_type,
      githubId: authUserTable.github_id
    })
    .from(authSessionTable)
    .innerJoin(authUserTable, eq(authSessionTable.user_id, authUserTable.id))
    .where(eq(authSessionTable.id, sessionId))
    .limit(1);
    
    if (sessionResult.length === 0) {
      request.log.debug(`Auth hook: Session ${sessionId} not found`);
      const sessionCookie = lucia.createBlankSessionCookie();
      reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
      request.user = null;
      request.session = null;
      return;
    }
    
    const sessionData = sessionResult[0];
    
    // Check if session is expired
    if (sessionData.expiresAt < Date.now()) {
      request.log.debug(`Auth hook: Session ${sessionId} is expired`);
      // Delete expired session
      await db.delete(authSessionTable).where(eq(authSessionTable.id, sessionId));
      const sessionCookie = lucia.createBlankSessionCookie();
      reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
      request.user = null;
      request.session = null;
      return;
    }
    
    // Create user and session objects
    const user = {
      id: sessionData.userId,
      username: sessionData.username,
      email: sessionData.email,
      firstName: sessionData.firstName,
      lastName: sessionData.lastName,
      authType: sessionData.authType,
      githubId: sessionData.githubId
    };
    
    const session = {
      id: sessionData.sessionId,
      userId: sessionData.userId,
      expiresAt: new Date(sessionData.expiresAt),
      fresh: false
    };

    request.log.debug(`Auth hook: Session ${sessionId} is valid for user ${user.id}`);
    
    request.user = user;
    request.session = session;
    // No explicit done() call, Fastify awaits the promise
  } catch (error) {
    // Error validating session, treat as unauthenticated
    request.log.error(error, 'Auth hook: Error validating session');
    request.user = null;
    request.session = null;
    // No explicit done() call
  }
}

// Example of a hook that requires authentication
export async function requireAuthHook(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // This hook assumes authHook has already run and populated request.user/session
  if (!request.user || !request.session) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication required.' });
  }
  // No need to call done() in modern Fastify async hooks
}
