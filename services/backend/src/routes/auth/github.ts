/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { getLucia } from '../../lib/lucia';
import { GithubCallbackSchema, type GithubCallbackInput } from './schemas';
import { getDb, getSchema } from '../../db';
import { eq } from 'drizzle-orm';
import { generateId } from 'lucia';
import { generateState } from 'arctic';
import { GlobalSettingsInitService } from '../../global-settings';

// Response schemas for GitHub OAuth API
const errorResponseSchema = z.object({
  error: z.string().describe('Error message')
});

const redirectResponseSchema = z.object({
  statusCode: z.number().describe('HTTP status code'),
  headers: z.object({
    location: z.string().describe('Redirect URL')
  }).describe('Response headers')
});

export default async function githubAuthRoutes(fastify: FastifyInstance) {
  // Route to initiate GitHub login
  fastify.get('/login', {
    schema: {
      tags: ['Authentication'],
      summary: 'Initiate GitHub OAuth login',
      description: 'Redirects the user to GitHub for OAuth authentication. This endpoint generates a state parameter for CSRF protection and redirects to GitHub\'s authorization URL.',
      response: {
        302: zodToJsonSchema(redirectResponseSchema.describe('Redirect to GitHub OAuth authorization URL'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Login is disabled by administrator or GitHub OAuth is disabled'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (_request, reply: FastifyReply) => { // _request type can be FastifyRequest if no specific generics needed here
      // Check if login is enabled
      const isLoginEnabled = await GlobalSettingsInitService.isLoginEnabled();
      if (!isLoginEnabled) {
        return reply.status(403).send({ 
          error: 'Login is currently disabled by administrator.' 
        });
      }

      // Check if GitHub OAuth is enabled and configured
      const githubConfig = await GlobalSettingsInitService.getGitHubOAuthConfiguration();
      if (!githubConfig) {
        return reply.status(403).send({ 
          error: 'GitHub OAuth is not enabled or not properly configured.' 
        });
      }

      const state = generateState();
      // PKCE is recommended for OAuth 2.0 public clients, but for confidential clients (server-side),
      // state alone is often sufficient for CSRF. Lucia's GitHub provider handles PKCE if code_verifier is passed.
      // For server-to-server, PKCE might be overkill if client_secret is kept secure.
      // const codeVerifier = generateCodeVerifier(); 

      // Create GitHub OAuth instance with settings from database
      const { GitHub } = await import('arctic');
      const githubAuth = new GitHub(
        githubConfig.clientId,
        githubConfig.clientSecret,
        githubConfig.callbackUrl
      );

      const scopes = githubConfig.scope.split(',').map(s => s.trim());
      const url = await githubAuth.createAuthorizationURL(state, scopes);

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
  fastify.get<{ Querystring: GithubCallbackInput }>('/callback', {
    schema: {
      tags: ['Authentication'],
      summary: 'GitHub OAuth callback',
      description: 'Handles the OAuth callback from GitHub after user authorization. Validates the state parameter, exchanges the authorization code for tokens, retrieves user information, and creates or links user accounts. Sets authentication session cookie on success.',
      querystring: zodToJsonSchema(GithubCallbackSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        302: zodToJsonSchema(redirectResponseSchema.describe('Redirect to frontend after successful authentication'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Invalid state parameter, OAuth error, or GitHub email not available'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Login is disabled by administrator'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        409: zodToJsonSchema(errorResponseSchema.describe('Conflict - User account conflict'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request, reply: FastifyReply) => { // request.query will be typed as GithubCallbackInput by Fastify
      // Check if login is enabled
      const isLoginEnabled = await GlobalSettingsInitService.isLoginEnabled();
      if (!isLoginEnabled) {
        return reply.status(403).send({ 
          error: 'Login is currently disabled by administrator.' 
        });
      }

      // Check if GitHub OAuth is enabled and configured
      const githubConfig = await GlobalSettingsInitService.getGitHubOAuthConfiguration();
      if (!githubConfig) {
        return reply.status(403).send({ 
          error: 'GitHub OAuth is not enabled or not properly configured.' 
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
        // Create GitHub OAuth instance with settings from database
        const { GitHub } = await import('arctic');
        const githubAuth = new GitHub(
          githubConfig.clientId,
          githubConfig.clientSecret,
          githubConfig.callbackUrl
        );

        const tokens = await githubAuth.validateAuthorizationCode(code);
        
        const githubUserResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken()}`
          }
        });
        
        if (!githubUserResponse.ok) {
          return reply.status(400).send({ error: 'Failed to fetch GitHub user information.' });
        }
        
        const githubUser = await githubUserResponse.json();
        
        // Always try to get email from the emails API first (more reliable for private emails)
        let userEmail = null;
        
        const githubEmailResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken()}`
          }
        });
        
        if (githubEmailResponse.ok) {
          const githubEmails = await githubEmailResponse.json();
          
          if (Array.isArray(githubEmails)) {
            // Try to find primary verified email first
            const primaryEmail = githubEmails.find((email: any) => email.primary && email.verified);
            if (primaryEmail) {
              userEmail = primaryEmail.email;
            } else {
              // Fallback to any verified email
              const verifiedEmail = githubEmails.find((email: any) => email.verified);
              if (verifiedEmail) {
                userEmail = verifiedEmail.email;
              } else {
                // Last resort: use any email
                const anyEmail = githubEmails.find((email: any) => email.email);
                if (anyEmail) {
                  userEmail = anyEmail.email;
                }
              }
            }
          }
        } else {
          // Fallback to public email from user profile
          if (githubUser.email) {
            userEmail = githubUser.email;
          }
        }
        
        if (!userEmail) {
          // Fallback: Use GitHub username + @github.local as email for development
          // This allows OAuth to work even without email access
          const fallbackEmail = `${githubUser.login}@github.local`;
          userEmail = fallbackEmail;
          
          // In production, you might want to fail here instead:
          // return reply.status(400).send({ 
          //   error: 'GitHub email not available. Please ensure you have at least one email address in your GitHub account and grant email permissions to this application.' 
          // });
        }
        
        githubUser.email = userEmail;
        
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
          const userId = existingUser[0].id;
          
          // Validate user ID is not null/undefined
          if (!userId) {
            return reply.status(500).send({ error: 'Invalid user data in database.' });
          }
          
          try {
            // Create session using manual method (workaround for Lucia adapter issue)
            const sessionId = generateId(40);
            const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days
            
            const authSessionTable = schema.authSession;
            await (db as any).insert(authSessionTable).values({
              id: sessionId,
              user_id: userId,
              expires_at: expiresAt.getTime()
            });
            
            const sessionCookie = getLucia().createSessionCookie(sessionId);
            reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
            
            const frontendUrl = await GlobalSettingsInitService.getPageUrl();
            return reply.redirect(frontendUrl);
            
          } catch (sessionError) {
            // Fallback to Lucia session creation
            fastify.log.warn(sessionError, 'Manual session creation failed, falling back to Lucia');
            try {
              const session = await getLucia().createSession(userId, {});
              const sessionCookie = getLucia().createSessionCookie(session.id);
              reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
              
              const frontendUrl = await GlobalSettingsInitService.getPageUrl();
              return reply.redirect(frontendUrl);
            } catch (luciaError) {
              throw luciaError;
            }
          }
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
          
          // Get frontend URL from global settings
          const frontendUrl = await GlobalSettingsInitService.getPageUrl();
          return reply.redirect(frontendUrl);
        }

        // Check if this would be the first user (prevent GitHub from creating global_admin)
        const allUsers = await (db as any).select().from(authUserTable).limit(1);
        const isFirstUser = allUsers.length === 0;
        
        if (isFirstUser) {
          fastify.log.warn('Attempted to create first user via GitHub OAuth - redirecting to email registration');
          return reply.status(403).send({ 
            error: 'The first user must be created via email registration to become the global administrator. Please use email registration instead.' 
          });
        }

        // Create a new user with global_user role (not global_admin)
        const newUserId = generateId(15);
        
        const newUserData = {
          id: newUserId,
          username: githubUser.login || `${githubUser.name?.replace(/\s+/g, '_')}_gh` || `gh_user_${newUserId}`,
          email: githubEmail.toLowerCase(),
          auth_type: 'github',
          first_name: githubUser.name?.split(' ')[0] || null,
          last_name: githubUser.name?.split(' ').slice(1).join(' ') || null,
          github_id: githubUser.id.toString(),
          role_id: 'global_user', // Explicitly set role for GitHub users
          email_verified: true, // GitHub emails are considered verified
        };
        
        await (db as any).insert(authUserTable).values(newUserData);

        // Create default team for the user
        try {
          const { TeamService } = await import('../../services/teamService');
          const username = githubUser.login || `gh_user_${newUserId}`;
          await TeamService.createDefaultTeamForUser(newUserId, username);
        } catch (teamError) {
          // Don't fail login if team creation fails
          fastify.log.warn(teamError, 'Failed to create default team for GitHub user');
        }

        // Create session using manual method (workaround for Lucia adapter issue)
        try {
          const sessionId = generateId(40);
          const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days
          
          const authSessionTable = schema.authSession;
          await (db as any).insert(authSessionTable).values({
            id: sessionId,
            user_id: newUserId,
            expires_at: expiresAt.getTime()
          });
          
          const sessionCookie = getLucia().createSessionCookie(sessionId);
          reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
          
        } catch (sessionError) {
          fastify.log.error(sessionError, 'Failed to create session for new GitHub user');
          throw sessionError;
        }
        
        // Get frontend URL from global settings
        const frontendUrl = await GlobalSettingsInitService.getPageUrl();
        return reply.redirect(frontendUrl);

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
