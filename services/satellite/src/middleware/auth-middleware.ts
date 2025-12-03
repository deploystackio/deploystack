import type { FastifyRequest, FastifyReply } from 'fastify';
import { TokenIntrospectionService, TokenValidationResult } from '../services/token-introspection-service';
import { McpActivityTracker } from '../services/mcp-activity-tracker';
import { deriveClientName, extractSessionId, extractIpAddress } from '../services/client-name-detector';

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
        try {
          const clientName = deriveClientName(request.headers as Record<string, string | string[] | undefined>);
          const sessionId = extractSessionId(request.headers as Record<string, string | string[] | undefined>);
          const ipAddress = extractIpAddress(
            request.headers as Record<string, string | string[] | undefined>,
            request.socket.remoteAddress
          );
          const userAgent = request.headers['user-agent'] || 'unknown';
          
          // Check if this is a tool call (mcp.tool.executed)
          // This is a simple heuristic - more sophisticated detection can be added later
          let isToolCall = false;
          if (request.url.includes('tools/call')) {
            isToolCall = true;
          } else if (request.body && typeof request.body === 'object' && 'method' in request.body) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            isToolCall = (request.body as any).method === 'tools/call';
          }

          activityTracker.trackRequest(
            request.auth.user.id,
            request.auth.team.id,
            request.auth.client_id,
            clientName,
            userAgent,
            ipAddress,
            sessionId,
            isToolCall
          );

          request.log.debug({
            operation: 'activity_tracked',
            userId: request.auth.user.id,
            teamId: request.auth.team.id,
            clientId: request.auth.client_id,
            clientName,
            isToolCall
          }, 'MCP client activity tracked');
        } catch (error) {
          // Activity tracking failure is non-fatal
          request.log.warn({
            operation: 'activity_tracking_failed',
            error: error instanceof Error ? error.message : String(error)
          }, 'Failed to track MCP client activity (non-fatal)');
        }
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
 * Send 401 Unauthorized with WWW-Authenticate header
 */
function sendAuthenticationRequired(reply: FastifyReply, _request: FastifyRequest) {
  const backendUrl = process.env.DEPLOYSTACK_BACKEND_URL || 'http://localhost:3000';
  // Public URL for OAuth - what MCP clients will use to reach the backend
  const backendPublicUrl = process.env.DEPLOYSTACK_BACKEND_PUBLIC_URL || backendUrl;

  const wwwAuthenticate = `Bearer realm="DeployStack MCP Satellite", ` +
    `authorizationUri="${backendPublicUrl}/api/oauth2/auth", ` +
    `tokenUri="${backendPublicUrl}/api/oauth2/token", ` +
    `resource="deploystack:mcp:satellite"`;

  const errorResponse = {
    jsonrpc: '2.0',
    error: {
      code: -32001,
      message: 'Authentication required',
      data: {
        message: 'Bearer token required for MCP access',
        authorization_uri: `${backendPublicUrl}/api/oauth2/auth`,
        token_uri: `${backendPublicUrl}/api/oauth2/token`
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
 * Send 401 Invalid Token error
 */
function sendInvalidTokenError(reply: FastifyReply, request: FastifyRequest, validationResult: TokenValidationResult) {
  const errorResponse = {
    jsonrpc: '2.0',
    error: {
      code: -32002,
      message: 'Invalid token',
      data: {
        message: validationResult.error_description || 'Token validation failed',
        error: validationResult.error
      }
    },
    id: null
  };

  const jsonString = JSON.stringify(errorResponse);
  return reply.status(401).type('application/json').send(jsonString);
}

/**
 * Send 403 Insufficient Scope error
 */
function sendInsufficientScopeError(reply: FastifyReply, request: FastifyRequest, requiredScope: string) {
  const errorResponse = {
    jsonrpc: '2.0',
    error: {
      code: -32004,
      message: 'Insufficient scope',
      data: {
        message: `Token missing required scope: ${requiredScope}`,
        required_scope: requiredScope
      }
    },
    id: null
  };

  const jsonString = JSON.stringify(errorResponse);
  return reply.status(403).type('application/json').send(jsonString);
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
