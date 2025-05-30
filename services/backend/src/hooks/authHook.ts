import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { getLucia } from '../lib/lucia';
import { getDbStatus } from '../db';
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
      request.user = null;
      request.session = null;
      return; // Proceed as unauthenticated
    }

    const { session, user } = await lucia.validateSession(sessionId);

    if (session && session.fresh) {
      // Session was refreshed, send new cookie
      const sessionCookie = lucia.createSessionCookie(session.id);
      reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }
    if (!session) {
      // Invalid session, clear cookie
      const sessionCookie = lucia.createBlankSessionCookie();
      reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }

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
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) {
  // This hook assumes authHook has already run and populated request.user/session
  if (!request.user || !request.session) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication required.' });
  }
  return done();
}
