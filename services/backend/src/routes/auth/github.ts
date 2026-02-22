/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { getLucia } from '../../lib/lucia';
import { type GithubCallbackInput } from './schemas';
import { getDb, getSchema } from '../../db';
import { eq } from 'drizzle-orm';
import { generateId } from 'lucia';
import { generateState } from 'arctic';
import { GlobalSettingsInitService } from '../../global-settings';
import { EmailService } from '../../email';
import { GlobalSettings } from '../../global-settings/helpers';
import { EVENT_NAMES } from '../../events';
import type { EventContext } from '../../events/types';

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    error: { type: 'string' }
  },
  required: ['error']
} as const;

const REDIRECT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    headers: {
      type: 'object',
      properties: {
        location: { type: 'string' }
      }
    }
  }
} as const;

// Validate return_to URL is a safe redirect (must be our backend OAuth URL)
const isValidReturnTo = (url: string, backendUrl: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    const backendParsed = new URL(backendUrl);
    // Only allow redirects to our backend's OAuth endpoints
    return parsedUrl.origin === backendParsed.origin &&
           parsedUrl.pathname.startsWith('/api/oauth2/');
  } catch {
    return false;
  }
};

// Interface for GitHub login query params
interface GitHubLoginQuery {
  return_to?: string;
}

export default async function githubAuthRoutes(server: FastifyInstance) {
  // Route to initiate GitHub login
  server.get<{ Querystring: GitHubLoginQuery }>('/login', {
    schema: {
      tags: ['Authentication'],
      summary: 'Initiate GitHub OAuth login',
      description: 'Redirects the user to GitHub for OAuth authentication. This endpoint generates a state parameter for CSRF protection and redirects to GitHub\'s authorization URL.',
      querystring: {
        type: 'object',
        properties: {
          return_to: {
            type: 'string',
            description: 'Optional URL to redirect to after successful authentication (must be a valid backend OAuth URL)'
          }
        },
        additionalProperties: false
      },
      response: {
        302: {
          ...REDIRECT_RESPONSE_SCHEMA,
          description: 'Redirect to GitHub OAuth authorization URL'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Login is disabled by administrator or GitHub OAuth is disabled'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply: FastifyReply) => {
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

      // Get return_to from query params and validate it
      const { return_to } = request.query;
      let validatedReturnTo: string | null = null;

      if (return_to) {
        // Get configured backend URL for validation
        const backendUrl = await GlobalSettingsInitService.getBackendUrl();
        if (isValidReturnTo(return_to, backendUrl)) {
          validatedReturnTo = return_to;
        } else {
          server.log.warn({
            operation: 'github_oauth_login',
            return_to,
            configuredBackendUrl: backendUrl,
          }, 'Invalid return_to URL provided, ignoring');
        }
      }

      // Create GitHub OAuth instance with settings from database
      const { GitHub } = await import('arctic');
      const githubAuth = new GitHub(
        githubConfig.clientId,
        githubConfig.clientSecret,
        githubConfig.callbackUrl
      );

      const scopes = githubConfig.scope.split(',').map(s => s.trim());
      const url = await githubAuth.createAuthorizationURL(state, scopes);

      // Store state and return_to in a JSON cookie
      const stateData = JSON.stringify({
        state,
        returnTo: validatedReturnTo
      });

      reply.setCookie('oauth_state', stateData, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 10, // 10 minutes
        sameSite: 'lax',
      });

      return reply.redirect(url.toString());
    }
  );

  // Route to handle GitHub callback
  server.get<{ Querystring: GithubCallbackInput }>('/callback', {
    schema: {
      tags: ['Authentication'],
      summary: 'GitHub OAuth callback',
      description: 'Handles the OAuth callback from GitHub after user authorization. Validates the state parameter, exchanges the authorization code for tokens, retrieves user information, and creates or links user accounts. Sets authentication session cookie on success.',
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' }
        },
        required: ['code', 'state']
      },
      response: {
        302: {
          ...REDIRECT_RESPONSE_SCHEMA,
          description: 'Redirect to frontend after successful authentication'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid state parameter, OAuth error, or GitHub email not available'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Login is disabled by administrator'
        },
        409: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Conflict - User account conflict'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
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

      const storedStateRaw = request.cookies?.oauth_state; // Access cookies safely, ensure @fastify/cookie is registered

      const { code, state } = request.query as GithubCallbackInput; // Cast if TS doesn't infer from generic, or rely on schema validation

      // Parse stored state JSON
      let storedState: string | null = null;
      let returnTo: string | null = null;

      if (storedStateRaw) {
        try {
          const stateData = JSON.parse(storedStateRaw);
          storedState = stateData.state;
          returnTo = stateData.returnTo;
        } catch {
          // Fallback for old format (plain state string)
          storedState = storedStateRaw;
        }
      }

      // Validate state
      if (!storedState || !state || storedState !== state) {
        server.log.warn('Invalid OAuth state parameter during GitHub callback.');
        return reply.status(400).send({ error: 'Invalid OAuth state. CSRF attempt?' });
      }

      // Clear the state cookie
      reply.setCookie('oauth_state', '', { maxAge: -1, path: '/' });

      // Helper to get redirect URL (return_to or frontend)
      const getRedirectUrl = async (): Promise<string> => {
        if (returnTo) {
          return returnTo;
        }
        return await GlobalSettingsInitService.getPageUrl();
      };

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
              userId: userId,
              expiresAt: expiresAt.getTime()
            });

            const sessionCookie = getLucia().createSessionCookie(sessionId);
            reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

            const redirectUrl = await getRedirectUrl();
            return reply.redirect(redirectUrl);

          } catch (sessionError) {
            // Fallback to Lucia session creation
            server.log.warn(sessionError, 'Manual session creation failed, falling back to Lucia');
            try {
              const session = await getLucia().createSession(userId, {});
              const sessionCookie = getLucia().createSessionCookie(session.id);
              reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

              const redirectUrl = await getRedirectUrl();
              return reply.redirect(redirectUrl);
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

          const redirectUrl = await getRedirectUrl();
          return reply.redirect(redirectUrl);
        }

        // Check if this would be the first user (prevent GitHub from creating global_admin)
        const allUsers = await (db as any).select().from(authUserTable).limit(1);
        const isFirstUser = allUsers.length === 0;

        if (isFirstUser) {
          server.log.warn('Attempted to create first user via GitHub OAuth - redirecting to email registration');
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

        // Queue welcome email if enabled (for new OAuth users)
        try {
          const shouldSendWelcome = await EmailService.shouldSendWelcomeEmail();
          if (shouldSendWelcome) {
            const userName = newUserData.first_name
              ? `${newUserData.first_name}${newUserData.last_name ? ` ${newUserData.last_name}` : ''}`
              : newUserData.username || 'User';

            const loginUrl = await GlobalSettings.get('global.page_url', 'http://localhost:5173') + '/login';
            const supportEmail = await GlobalSettings.get('smtp.from_email') || undefined;

            // Queue welcome email as background job
            const jobQueueService = (server as any).jobQueueService;
            if (jobQueueService) {
              await jobQueueService.createJob('send_email', {
                to: newUserData.email,
                subject: 'Welcome to DeployStack',
                template: 'welcome',
                variables: {
                  userName,
                  userEmail: newUserData.email,
                  loginUrl,
                  supportEmail
                }
              });
              server.log.info(`Welcome email queued for ${newUserData.email}`);
            } else {
              server.log.warn('Job queue service not available, skipping welcome email');
            }
          }
        } catch (error: unknown) {
          // Don't fail OAuth if welcome email queueing fails
          server.log.warn({
            error,
            userId: newUserId,
            operation: 'queue_welcome_email_after_oauth_signup'
          }, 'Error occurred while trying to queue welcome email after GitHub OAuth signup');
        }

        // Create default team for the user
        try {
          const { TeamService } = await import('../../services/teamService');
          const username = githubUser.login || `gh_user_${newUserId}`;
          await TeamService.createDefaultTeamForUser(newUserId, username, server.log);
        } catch (teamError) {
          // Don't fail login if team creation fails
          server.log.warn(teamError, 'Failed to create default team for GitHub user');
        }

        // Emit USER_REGISTERED event for new GitHub users
        try {
          const eventContext: EventContext = {
            db,
            logger: server.log,
            user: {
              id: newUserId,
              email: newUserData.email,
              roleId: newUserData.role_id
            },
            request: {
              ip: request.ip,
              userAgent: request.headers['user-agent'],
              requestId: request.id
            },
            timestamp: new Date()
          };

          server.eventBus.emitWithContext(
            EVENT_NAMES.USER_REGISTERED,
            {
              user: {
                id: newUserId,
                email: newUserData.email,
                name: newUserData.username || `${newUserData.first_name || ''} ${newUserData.last_name || ''}`.trim() || newUserData.email,
                createdAt: new Date()
              },
              metadata: {
                registrationMethod: 'oauth',
                ip: request.ip,
                userAgent: request.headers['user-agent']
              }
            },
            eventContext
          );
          server.log.info(`USER_REGISTERED event emitted for GitHub user: ${newUserId}`);
        } catch (eventError) {
          server.log.error(eventError, `Failed to emit USER_REGISTERED event for GitHub user ${newUserId}:`);
          // Don't fail registration if event emission fails
        }

        // Create session using manual method (workaround for Lucia adapter issue)
        try {
          const sessionId = generateId(40);
          const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

          const authSessionTable = schema.authSession;
          await (db as any).insert(authSessionTable).values({
            id: sessionId,
            userId: newUserId,
            expiresAt: expiresAt.getTime()
          });

          const sessionCookie = getLucia().createSessionCookie(sessionId);
          reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

        } catch (sessionError) {
          server.log.error(sessionError, 'Failed to create session for new GitHub user');
          throw sessionError;
        }

        const redirectUrl = await getRedirectUrl();
        return reply.redirect(redirectUrl);

      } catch (error: unknown) {
        server.log.error(error, 'Error during GitHub OAuth callback:');
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
