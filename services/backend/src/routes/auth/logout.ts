/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getLucia } from '../../lib/lucia';
import { getDb, getSchema, getDbStatus } from '../../db';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { EVENT_NAMES } from '../../events';
import type { EventContext } from '../../events/types';

// Zod schema for the logout response
const logoutResponseSchema = z.object({
  success: z.boolean().describe("Indicates if the logout operation was successful"),
  message: z.string().describe("Human-readable message about the logout result")
}).describe(JSON.stringify({ // Adding examples via describe + jsonDescription postProcess
  // Fastify's schema validator expects 'examples' at this level to be an array.
  examples: [ 
    { success: true, message: 'Logged out successfully.' },
    { success: true, message: 'No active session to logout or already logged out.' }
  ]
}));

export default async function logoutRoute(fastify: FastifyInstance) {
  const logoutSchema = {
    tags: ['Authentication'],
    summary: 'User logout',
    description: 'Invalidates the current user session and clears authentication cookies. This endpoint can be called even without an active session.',
    security: [{ cookieAuth: [] }],
    response: {
      200: createSchema(logoutResponseSchema)
    }
  };

  fastify.post(
    '/logout',
    { schema: logoutSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // The global authHook should have already populated request.session if a valid session exists.
      // It also handles creating a blank session cookie if the session was invalid.
      const lucia = getLucia();

      // Log session information for debugging
      fastify.log.info(`Logout attempt - Session exists: ${!!request.session}, Session ID: ${request.session?.id || 'none'}`);

      if (!request.session) {
        // No active session found by authHook, but let's check if there's a session cookie
        // and manually clean it up if Lucia validation failed
        const sessionId = lucia.readSessionCookie(request.headers.cookie ?? '');
        
        if (sessionId) {
          fastify.log.info(`Found session cookie ${sessionId} but authHook couldn't validate it - attempting manual cleanup`);
          
          try {
            // Try to manually delete the session from database
            const db = getDb();
            const schema = getSchema();
            const authSessionTable = schema.authSession;
            
            // Verify table and column exist before attempting deletion
            if (authSessionTable && authSessionTable.id) {
              const dbStatus = getDbStatus();
              if (dbStatus.dialect === 'sqlite') {
                 
                const sqliteDb = db as BetterSQLite3Database<any>;
                await sqliteDb.delete(authSessionTable).where(eq(authSessionTable.id, sessionId));
              }
              fastify.log.info(`Manually deleted session ${sessionId} from database`);
            } else {
              fastify.log.warn('authSession table or id column not found in schema');
            }
          } catch (dbError) {
            fastify.log.error(dbError, 'Failed to manually delete session from database');
          }
        }
        
        // Send a blank cookie to ensure client-side cookie is cleared
        const blankCookie = lucia.createBlankSessionCookie();
        reply.setCookie(blankCookie.name, blankCookie.value, blankCookie.attributes);
        fastify.log.info('No active session to logout - sending blank cookie');
        
        const response = { success: true, message: 'No active session to logout or already logged out.' };
        const jsonString = JSON.stringify(response);
        return reply.status(200).type('application/json').send(jsonString);
      }

      try {
        const sessionId = request.session.id;
        fastify.log.info(`Attempting to invalidate session: ${sessionId}`);
        
        // Invalidate the session identified by authHook.
        await lucia.invalidateSession(sessionId);
        fastify.log.info(`Session ${sessionId} invalidated successfully`);
        
        // Send a blank cookie to ensure client-side cookie is cleared.
        const blankCookie = lucia.createBlankSessionCookie();
        reply.setCookie(blankCookie.name, blankCookie.value, blankCookie.attributes);
        fastify.log.info('Blank cookie sent to clear client session');
        
        // Emit USER_LOGOUT event
        try {
          if (request.user) {
            // Get user role from database since it's not in the session
            const db = getDb();
            const schema = getSchema();
            const authUserTable = schema.authUser;
            let userRole = 'unknown';
            
            try {
              const userResult = await (db as any)
                .select({ role_id: authUserTable.role_id })
                .from(authUserTable)
                .where(eq(authUserTable.id, request.user.id))
                .limit(1);
              
              if (userResult.length > 0) {
                userRole = userResult[0].role_id;
              }
            } catch (roleError) {
              fastify.log.warn(roleError, 'Failed to fetch user role for logout event');
            }

            const eventContext: EventContext = {
              db,
              logger: fastify.log,
              user: {
                id: request.user.id,
                email: (request.user as any).email,
                roleId: userRole
              },
              request: {
                ip: request.ip,
                userAgent: request.headers['user-agent'],
                requestId: request.id
              },
              timestamp: new Date()
            };

            fastify.eventBus.emitWithContext(
              EVENT_NAMES.USER_LOGOUT,
              {
                user: {
                  id: request.user.id,
                  email: (request.user as any).email,
                  name: (request.user as any).username || `${(request.user as any).firstName || ''} ${(request.user as any).lastName || ''}`.trim() || (request.user as any).email
                },
                metadata: {
                  ip: request.ip,
                  userAgent: request.headers['user-agent']
                }
              },
              eventContext
            );
            fastify.log.info(`USER_LOGOUT event emitted for user: ${request.user.id}`);
          }
        } catch (eventError) {
          fastify.log.error(eventError, 'Failed to emit USER_LOGOUT event:');
          // Don't fail logout if event emission fails
        }
        
        const response = { success: true, message: 'Logged out successfully.' };
        const jsonString = JSON.stringify(response);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        fastify.log.error(error, 'Error during logout (invalidating session from authHook):');
        
        // If Lucia invalidation failed, try manual database cleanup
        const sessionId = request.session.id;
        try {
          const db = getDb();
          const schema = getSchema();
          const authSessionTable = schema.authSession;
          
          // Verify table and column exist before attempting deletion
          if (authSessionTable && authSessionTable.id) {
            const dbStatus = getDbStatus();
            if (dbStatus.dialect === 'sqlite') {
               
              const sqliteDb = db as BetterSQLite3Database<any>;
              await sqliteDb.delete(authSessionTable).where(eq(authSessionTable.id, sessionId));
            }
            fastify.log.info(`Manually deleted session ${sessionId} after Lucia invalidation failed`);
          } else {
            fastify.log.warn('authSession table or id column not found in schema');
          }
        } catch (dbError) {
          fastify.log.error(dbError, 'Failed to manually delete session after Lucia error');
        }
        
        // Even if there's an error, try to clear the cookie.
        const blankCookie = lucia.createBlankSessionCookie();
        reply.setCookie(blankCookie.name, blankCookie.value, blankCookie.attributes);
        
        const response = { success: true, message: 'Logged out successfully (with fallback cleanup).' };
        const jsonString = JSON.stringify(response);
        return reply.status(200).type('application/json').send(jsonString);
      }
    }
  );
}
