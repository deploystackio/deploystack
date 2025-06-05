/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { getLucia, getGithubAuth } from '../../lib/lucia';
import { type GithubCallbackInput } from './schemas';
import { getDb, getSchema } from '../../db';
import { eq } from 'drizzle-orm';
import { generateId } from 'lucia';
import { generateState } from 'arctic';
import { GlobalSettingsInitService } from '../../global-settings';

// Define types for requests with specific query parameters
const GITHUB_SCOPES = ['user:email']; // Request access to user's email

export default async function githubAuthRoutes(fastify: FastifyInstance) {
  // Route to initiate GitHub login
  fastify.get(
    '/login',
    async (_request, reply: FastifyReply) => { // _request type can be FastifyRequest if no specific generics needed here
      // Check if login is enabled
      const isLoginEnabled = await GlobalSettingsInitService.isLoginEnabled();
      if (!isLoginEnabled) {
        return reply.status(403).send({ 
          error: 'Login is currently disabled by administrator.' 
        });
      }

      const state = generateState();
      // PKCE is recommended for OAuth 2.0 public clients, but for confidential clients (server-side),
      // state alone is often sufficient for CSRF. Lucia's GitHub provider handles PKCE if code_verifier is passed.
      // For server-to-server, PKCE might be overkill if client_secret is kept secure.
      // const codeVerifier = generateCodeVerifier(); 

      const url = await getGithubAuth().createAuthorizationURL(state, GITHUB_SCOPES);

      // Store state and code_verifier (if using PKCE) in a temporary cookie or server-side session
      // to verify them in the callback
      reply.setCookie('oauth_state', state, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 10, // 10 minutes
        sameSite: 'lax',
      });
      // if (codeVerifier) {
      //   reply.setCookie('oauth_code_verifier', codeVerifier, { /* ... cookie options ... */ });
      // }

      return reply.redirect(url.toString());
    }
  );

  // Route to handle GitHub callback
  fastify.get<{ Querystring: GithubCallbackInput }>(
    '/callback',
    async (request, reply: FastifyReply) => { // request.query will be typed as GithubCallbackInput by Fastify
      // Check if login is enabled
      const isLoginEnabled = await GlobalSettingsInitService.isLoginEnabled();
      if (!isLoginEnabled) {
        return reply.status(403).send({ 
          error: 'Login is currently disabled by administrator.' 
        });
      }

      const storedState = request.cookies?.oauth_state; // Access cookies safely, ensure @fastify/cookie is registered
      // const storedCodeVerifier = request.cookies?.oauth_code_verifier; // if using PKCE

      const { code, state } = request.query as GithubCallbackInput; // Cast if TS doesn't infer from generic, or rely on schema validation

      // Validate state
      if (!storedState || !state || storedState !== state) {
        fastify.log.warn('Invalid OAuth state parameter during GitHub callback.');
        return reply.status(400).send({ error: 'Invalid OAuth state. CSRF attempt?' });
      }

      // Clear the state cookie
      reply.setCookie('oauth_state', '', { maxAge: -1, path: '/' });

      try {
        const tokens = await getGithubAuth().validateAuthorizationCode(code);
        const githubUserResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        });
        const githubUser = await githubUserResponse.json();
        
        // Get user email
        const githubEmailResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        });
        const githubEmails = await githubEmailResponse.json();
        const primaryEmail = githubEmails.find((email: any) => email.primary && email.verified);
        
        if (!primaryEmail) {
          fastify.log.error('GitHub user email not available or not verified.');
          return reply.status(400).send({ error: 'GitHub email not available. Please ensure your email is public and verified on GitHub.' });
        }
        
        githubUser.email = primaryEmail.email;
        
        // Get database and schema
        const db = getDb();
        const schema = getSchema();
        const authUserTable = schema.authUser;
        
        if (!authUserTable) {
          throw new Error('Auth tables not found in schema.');
        }
        
        // Check if user already exists with this GitHub ID
        const existingUser = await (db as any)
          .select()
          .from(authUserTable)
          .where(eq(authUserTable.github_id, githubUser.id.toString()))
          .limit(1);

        if (existingUser.length > 0) {
          const session = await getLucia().createSession(existingUser[0].id, {});
          const sessionCookie = getLucia().createSessionCookie(session.id);
          reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
          return reply.redirect(process.env.FRONTEND_LOGIN_SUCCESS_REDIRECT_URL || '/'); // Redirect to frontend
        }

        // User does not exist with this GitHub ID, try to find by email or create new
        const githubEmail = githubUser.email;

        // Check if a user already exists with this email (e.g., signed up via email)
        const userWithSameEmail = await (db as any)
          .select()
          .from(authUserTable)
          .where(eq(authUserTable.email, githubEmail.toLowerCase()))
          .limit(1);

        if (userWithSameEmail.length > 0) {
          const existingUserId = userWithSameEmail[0].id;
          // Update existing user to link GitHub account
          await (db as any)
            .update(authUserTable)
            .set({ github_id: githubUser.id.toString() })
            .where(eq(authUserTable.id, existingUserId));
          
          const session = await getLucia().createSession(existingUserId, {});
          const sessionCookie = getLucia().createSessionCookie(session.id);
          reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
          return reply.redirect(process.env.FRONTEND_LOGIN_SUCCESS_REDIRECT_URL || '/');
        }

        // Create a new user
        const newUserId = generateId(15);
        await (db as any).insert(authUserTable).values({
          id: newUserId,
          username: githubUser.login || `${githubUser.name?.replace(/\s+/g, '_')}_gh` || `gh_user_${newUserId}`,
          email: githubEmail.toLowerCase(),
          auth_type: 'github',
          first_name: githubUser.name?.split(' ')[0] || null,
          last_name: githubUser.name?.split(' ').slice(1).join(' ') || null,
          github_id: githubUser.id.toString(),
        });


        const session = await getLucia().createSession(newUserId, {});
        const sessionCookie = getLucia().createSessionCookie(session.id);
        reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
        return reply.redirect(process.env.FRONTEND_LOGIN_SUCCESS_REDIRECT_URL || '/'); // Redirect to frontend

      } catch (error) {
        fastify.log.error(error, 'Error during GitHub OAuth callback:');
        if (error instanceof Error && error.message.includes('OAuth')) {
          // Specific OAuth errors (e.g., invalid code)
          return reply.status(400).send({ error: 'GitHub OAuth error: ' + error.message });
        }
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            return reply.status(409).send({ error: 'A user with this GitHub account or email already exists in a conflicting way.' });
        }
        return reply.status(500).send({ error: 'An unexpected error occurred during GitHub login.' });
      }
    }
  );
}
