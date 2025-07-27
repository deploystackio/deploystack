import type { FastifyRequest, FastifyReply } from 'fastify';
import { TokenService } from '../services/oauth/tokenService';

// Extend FastifyRequest to include OAuth token payload
declare module 'fastify' {
  interface FastifyRequest {
    tokenPayload?: {
      user: {
        id: string;
        email: string;
        username: string;
        firstName: string | null;
        lastName: string | null;
      };
      scope: string[];
      clientId: string;
      tokenId: string;
    };
  }
}

/**
 * Middleware to require valid OAuth2 access token
 */
export function requireValidAccessToken() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const errorResponse = {
          error: 'invalid_request',
          error_description: 'Missing or invalid Authorization header. Expected format: Bearer <token>'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify the access token
      const tokenPayload = await TokenService.verifyAccessToken(accessToken, request.log);
      
      if (!tokenPayload) {
        const errorResponse = {
          error: 'invalid_token',
          error_description: 'Access token is invalid, expired, or revoked'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      // Set token payload for use in route handlers
      request.tokenPayload = tokenPayload;

      // Also set user for compatibility with existing middleware
      request.user = {
        id: tokenPayload.user.id,
        email: tokenPayload.user.email,
        firstName: tokenPayload.user.firstName,
        lastName: tokenPayload.user.lastName,
        authType: 'oauth2',
        githubId: null
      } as any; // Cast to any to avoid type conflicts with Lucia User type

      request.log.debug({
        operation: 'oauth_middleware',
        userId: tokenPayload.user.id,
        clientId: tokenPayload.clientId,
        scope: tokenPayload.scope,
      }, 'OAuth2 access token validated successfully');

    } catch (error) {
      request.log.error({
        operation: 'oauth_middleware',
        error,
      }, 'OAuth2 middleware error');
      
      const errorResponse = {
        error: 'server_error',
        error_description: 'An error occurred while validating the access token'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  };
}

/**
 * Middleware to require specific OAuth2 scope
 */
export function requireOAuthScope(requiredScope: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // This middleware should run after requireValidAccessToken
    if (!request.tokenPayload) {
      const errorResponse = {
        error: 'invalid_request',
        error_description: 'OAuth2 token validation required before scope check'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }

    const userScopes = request.tokenPayload.scope;
    
    if (!userScopes.includes(requiredScope)) {
      request.log.warn({
        operation: 'oauth_scope_check',
        userId: request.tokenPayload.user.id,
        requiredScope,
        userScopes,
      }, 'OAuth2 scope check failed');

      const errorResponse = {
        error: 'insufficient_scope',
        error_description: `Access token does not have required scope: ${requiredScope}`,
        scope: requiredScope
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(403).type('application/json').send(jsonString);
    }

    request.log.debug({
      operation: 'oauth_scope_check',
      userId: request.tokenPayload.user.id,
      requiredScope,
      result: 'granted',
    }, 'OAuth2 scope check passed');
  };
}

/**
 * Middleware to require any of the specified OAuth2 scopes
 */
export function requireAnyOAuthScope(requiredScopes: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // This middleware should run after requireValidAccessToken
    if (!request.tokenPayload) {
      const errorResponse = {
        error: 'invalid_request',
        error_description: 'OAuth2 token validation required before scope check'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }

    const userScopes = request.tokenPayload.scope;
    const hasRequiredScope = requiredScopes.some(scope => userScopes.includes(scope));
    
    if (!hasRequiredScope) {
      request.log.warn({
        operation: 'oauth_scope_check',
        userId: request.tokenPayload.user.id,
        requiredScopes,
        userScopes,
      }, 'OAuth2 scope check failed - none of required scopes found');

      const errorResponse = {
        error: 'insufficient_scope',
        error_description: `Access token does not have any of the required scopes: ${requiredScopes.join(', ')}`,
        scope: requiredScopes.join(' ')
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(403).type('application/json').send(jsonString);
    }

    request.log.debug({
      operation: 'oauth_scope_check',
      userId: request.tokenPayload.user.id,
      requiredScopes,
      result: 'granted',
    }, 'OAuth2 scope check passed');
  };
}

/**
 * Middleware that accepts either cookie-based auth OR OAuth2 Bearer token
 * This allows endpoints to work with both web users and CLI users
 */
export function requireAuthenticationAny() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if user is already authenticated via cookie (from authHook)
    if (request.user && request.session) {
      request.log.debug({
        operation: 'dual_auth_middleware',
        userId: request.user.id,
        authType: 'cookie',
      }, 'User authenticated via cookie session');
      return; // Already authenticated via cookie
    }

    // Try OAuth2 Bearer token authentication
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.substring(7);
      
      try {
        const tokenPayload = await TokenService.verifyAccessToken(accessToken, request.log);
        
        if (tokenPayload) {
          // Set token payload and user for OAuth2 authentication
          request.tokenPayload = tokenPayload;
          request.user = {
            id: tokenPayload.user.id,
            email: tokenPayload.user.email,
            firstName: tokenPayload.user.firstName,
            lastName: tokenPayload.user.lastName,
            authType: 'oauth2',
            githubId: null
          } as any; // Cast to any to avoid type conflicts with Lucia User type

          request.log.debug({
            operation: 'dual_auth_middleware',
            userId: tokenPayload.user.id,
            authType: 'oauth2',
            clientId: tokenPayload.clientId,
          }, 'User authenticated via OAuth2 Bearer token');
          return; // Successfully authenticated via OAuth2
        }
      } catch (error) {
        request.log.debug({
          operation: 'dual_auth_middleware',
          error,
        }, 'OAuth2 token validation failed, trying cookie auth');
        // Fall through to require authentication
      }
    }

    // Neither cookie nor OAuth2 authentication succeeded
    const errorResponse = {
      success: false,
      error: 'Authentication required. Please provide either a valid session cookie or OAuth2 Bearer token.'
    };
    const jsonString = JSON.stringify(errorResponse);
    return reply.status(401).type('application/json').send(jsonString);
  };
}
