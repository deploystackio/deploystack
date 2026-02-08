import type { FastifyRequest, FastifyReply } from 'fastify';
import { TokenIntrospectionService, TokenValidationResult } from '../services/token-introspection-service';
import { McpActivityTracker } from '../services/mcp-activity-tracker';
import { trackMcpActivity } from '../services/activity-tracking-helper';

// Extend FastifyRequest to include authentication context
declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      user: {
        id: string;
        username: string;
      };
      team: {
        id: string;
        name: string;
        role: string;
        permissions: string[];
      };
      scopes: string[];
      client_id?: string;
    };
  }
}

/**
 * Add RFC 9728 Link header for OAuth discovery to all responses
 * This enables MCP clients to discover protected resource metadata proactively
 */
function addResourceMetadataLinkHeader(reply: FastifyReply) {
  reply.header('Link', '</.well-known/oauth-protected-resource>; rel="oauth-protected-resource"');
}

/**
 * Middleware to require valid OAuth2 Bearer token for multi-team access
 *
 * @param introspectionService - Service for validating OAuth tokens
 * @param activityTracker - Optional tracker for MCP client activity (for personal dashboard)
 */
export function requireAuthentication(
  introspectionService: TokenIntrospectionService,
  activityTracker?: McpActivityTracker
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Add RFC 9728 Link header to ALL responses (success and error)
      addResourceMetadataLinkHeader(reply);

      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendAuthenticationRequired(reply, request);
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Validate token with Backend (supports any valid team)
      const validationResult = await introspectionService.validateToken(token);

      if (!validationResult.valid) {
        request.log.warn({
          operation: 'authentication_failed',
          error: validationResult.error,
          error_description: validationResult.error_description
        }, 'Authentication failed');

        return sendInvalidTokenError(reply, request, validationResult);
      }

      // Set authentication context for route handlers
      request.auth = {
        user: validationResult.user!,
        team: validationResult.team!,
        scopes: validationResult.scopes!,
        client_id: validationResult.client_id
      };

      request.log.debug({
        operation: 'authentication_success',
        userId: request.auth.user.id,
        teamId: request.auth.team.id,
        clientId: request.auth.client_id,
        scopes: request.auth.scopes
      }, 'Authentication successful');

      // Track MCP client activity for personal dashboard (if tracker provided)
      if (activityTracker && request.auth.client_id) {
        trackMcpActivity(activityTracker, request, {
          userId: request.auth.user.id,
          teamId: request.auth.team.id,
          authIdentifier: request.auth.client_id,
          authType: 'oauth',
        }, request.log);
      }

    } catch (error) {
      request.log.error({
        operation: 'authentication_middleware_error',
        error: error instanceof Error ? error.message : String(error)
      }, 'Authentication middleware error');

      return sendServerError(reply, request);
    }
  };
}

/**
 * Middleware to require specific OAuth2 scope
 */
export function requireScope(requiredScope: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      request.log.error({
        operation: 'scope_check_no_auth',
        requiredScope
      }, 'Scope check called without authentication context');
      return sendServerError(reply, request);
    }

    const userScopes = request.auth.scopes;

    if (!userScopes.includes(requiredScope)) {
      request.log.warn({
        operation: 'insufficient_scope',
        userId: request.auth.user.id,
        teamId: request.auth.team.id,
        requiredScope,
        userScopes
      }, 'Insufficient scope for operation');

      return sendInsufficientScopeError(reply, request, requiredScope);
    }

    request.log.debug({
      operation: 'scope_check_passed',
      userId: request.auth.user.id,
      teamId: request.auth.team.id,
      requiredScope
    }, 'Scope check passed');
  };
}

/**
 * Send 401 Unauthorized with RFC 9728 compliant WWW-Authenticate header
 */
function sendAuthenticationRequired(reply: FastifyReply, _request: FastifyRequest) {
  const satelliteUrl = process.env.DEPLOYSTACK_SATELLITE_URL || `http://localhost:${process.env.PORT || 3001}`;

  // RFC 9728: Point to protected resource metadata for discovery
  const resourceMetadataUri = `${satelliteUrl}/.well-known/oauth-protected-resource`;

  // RFC 9728 compliant WWW-Authenticate header
  const wwwAuthenticate = `Bearer realm="DeployStack MCP Satellite", ` +
    `resource_metadata="${resourceMetadataUri}", ` +
    `scope="mcp:read mcp:tools:execute", ` +
    `error="invalid_token", ` +
    `error_description="Bearer token required"`;

  // RFC 9728 compliant error response body
  const errorResponse = {
    jsonrpc: '2.0',
    error: {
      code: -32001,
      message: 'Authentication required',
      data: {
        message: 'Bearer token required for MCP access',
        oauth_error: 'invalid_token',
        resource_metadata_uri: resourceMetadataUri,
        scopes_required: ['mcp:read']
      }
    },
    id: null
  };

  const jsonString = JSON.stringify(errorResponse);
  return reply
    .status(401)
    .header('WWW-Authenticate', wwwAuthenticate)
    .type('application/json')
    .send(jsonString);
}

/**
 * Send 401 Invalid Token error with RFC 9728 compliant headers
 */
function sendInvalidTokenError(reply: FastifyReply, request: FastifyRequest, validationResult: TokenValidationResult) {
  const satelliteUrl = process.env.DEPLOYSTACK_SATELLITE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const resourceMetadataUri = `${satelliteUrl}/.well-known/oauth-protected-resource`;

  // RFC 9728 compliant WWW-Authenticate header
  const wwwAuthenticate = `Bearer realm="DeployStack MCP Satellite", ` +
    `resource_metadata="${resourceMetadataUri}", ` +
    `error="invalid_token", ` +
    `error_description="${validationResult.error_description || 'Token validation failed'}"`;

  const errorResponse = {
    jsonrpc: '2.0',
    error: {
      code: -32002,
      message: 'Invalid token',
      data: {
        message: validationResult.error_description || 'Token validation failed',
        oauth_error: 'invalid_token',
        resource_metadata_uri: resourceMetadataUri
      }
    },
    id: null
  };

  const jsonString = JSON.stringify(errorResponse);
  return reply
    .status(401)
    .header('WWW-Authenticate', wwwAuthenticate)
    .type('application/json')
    .send(jsonString);
}

/**
 * Send 403 Insufficient Scope error with RFC 9728 compliant headers
 */
function sendInsufficientScopeError(reply: FastifyReply, request: FastifyRequest, requiredScope: string) {
  const satelliteUrl = process.env.DEPLOYSTACK_SATELLITE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const resourceMetadataUri = `${satelliteUrl}/.well-known/oauth-protected-resource`;

  // RFC 9728 compliant WWW-Authenticate header
  const wwwAuthenticate = `Bearer realm="DeployStack MCP Satellite", ` +
    `resource_metadata="${resourceMetadataUri}", ` +
    `scope="${requiredScope}", ` +
    `error="insufficient_scope", ` +
    `error_description="Token missing required scope: ${requiredScope}"`;

  const errorResponse = {
    jsonrpc: '2.0',
    error: {
      code: -32004,
      message: 'Insufficient scope',
      data: {
        message: `Token missing required scope: ${requiredScope}`,
        oauth_error: 'insufficient_scope',
        required_scopes: [requiredScope],
        resource_metadata_uri: resourceMetadataUri
      }
    },
    id: null
  };

  const jsonString = JSON.stringify(errorResponse);
  return reply
    .status(403)
    .header('WWW-Authenticate', wwwAuthenticate)
    .type('application/json')
    .send(jsonString);
}

/**
 * Send 500 Server Error
 */
function sendServerError(reply: FastifyReply, _request: FastifyRequest) {
  const errorResponse = {
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message: 'Internal server error',
      data: 'Authentication system error'
    },
    id: null
  };

  const jsonString = JSON.stringify(errorResponse);
  return reply.status(500).type('application/json').send(jsonString);
}
