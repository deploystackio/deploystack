/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyInstance } from 'fastify';
import { requireAuthentication, requireScope } from '../middleware/auth-middleware';

// SSE Connection Response Schema (unused but kept for future use)
/*
const SSE_CONNECTION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    status: { 
      type: 'string',
      description: 'Connection status'
    },
    message: { 
      type: 'string',
      description: 'Human-readable status message'
    }
  },
  required: ['status', 'message']
} as const;
*/

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean', 
      default: false,
      description: 'Indicates failure'
    },
    error: { 
      type: 'string',
      description: 'Error message'
    }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces
interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function sseRoute(server: FastifyInstance) {
  // Get handlers from server instance (initialized in server.ts)
  const sessionManager = (server as any).sessionManager;
  const sseHandler = (server as any).sseHandler;
  const tokenIntrospectionService = (server as any).tokenIntrospectionService;

  if (!sessionManager || !sseHandler) {
    throw new Error('Session manager and SSE handler must be initialized before registering SSE routes');
  }

  if (!tokenIntrospectionService) {
    throw new Error('Token introspection service must be initialized before registering SSE routes');
  }

  server.get('/sse', {
    preValidation: [
      requireAuthentication(tokenIntrospectionService),
      requireScope('mcp:read')
    ],
    schema: {
      tags: ['MCP Transport'],
      summary: 'Establish SSE connection',
      description: 'Establishes a Server-Sent Events connection for MCP client communication. Returns a session endpoint URL for sending JSON-RPC messages.',
      response: {
        200: {
          type: 'string',
          description: 'SSE stream with endpoint event',
          headers: {
            'Content-Type': { type: 'string', enum: ['text/event-stream'] },
            'Cache-Control': { type: 'string', enum: ['no-cache'] },
            'Connection': { type: 'string', enum: ['keep-alive'] }
          }
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      server.log.info({
        operation: 'sse_route_accessed',
        userId: request.auth?.user.id,
        teamId: request.auth?.team.id,
        clientId: request.auth?.client_id,
        userAgent: request.headers['user-agent'],
        remoteAddress: request.ip
      }, 'Authenticated SSE route accessed');

      // Establish SSE connection - this handles the response directly
      await sseHandler.establishConnection(request, reply);

    } catch (error) {
      server.log.error({
        operation: 'sse_route_error',
        error: error instanceof Error ? error.message : String(error)
      }, 'SSE route error');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to establish SSE connection'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
