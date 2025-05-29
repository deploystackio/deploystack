import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getLucia } from '../../lib/lucia';

export default async function logoutRoute(fastify: FastifyInstance) {
  fastify.post(
    '/logout',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = getLucia().readSessionCookie(request.headers.cookie ?? '');

      if (!sessionId) {
        // No session cookie, so user is effectively logged out or was never logged in.
        // It's good practice to still clear any potential lingering cookie on the client.
        const sessionCookie = getLucia().createBlankSessionCookie();
        reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
        return reply.status(200).send({ message: 'No active session to logout or already logged out.' });
      }

      try {
        const { session } = await getLucia().validateSession(sessionId);

        if (session) {
          await getLucia().invalidateSession(session.id);
        }
        
        // Always send a blank cookie to ensure client-side cookie is cleared
        const sessionCookie = getLucia().createBlankSessionCookie();
        reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
        
        return reply.status(200).send({ message: 'Logged out successfully.' });

      } catch (error) {
        fastify.log.error(error, 'Error during logout:');
        // Even if there's an error (e.g., session already invalid), try to clear the cookie.
        const sessionCookie = getLucia().createBlankSessionCookie();
        reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
        return reply.status(500).send({ error: 'An error occurred during logout.' });
      }
    }
  );
}
