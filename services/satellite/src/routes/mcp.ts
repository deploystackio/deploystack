/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyInstance } from 'fastify';
import { requireAuthentication, requireScope } from '../middleware/auth-middleware';

// JSON-RPC Message Schema Constants
const JSONRPC_MESSAGE_SCHEMA = {
  type: 'object',
  properties: {
    jsonrpc: { 
      type: 'string', 
      enum: ['2.0'],
      description: 'JSON-RPC version'
    },
    id: { 
      type: ['string', 'number', 'null'],
      description: 'Request identifier'
    },
    method: { 
      type: 'string',
      description: 'Method name to call'
    },
    params: { 
      type: 'object',
      description: 'Method parameters'
    }
  },
  required: ['jsonrpc', 'method'],
  additionalProperties: false
} as const;

const JSONRPC_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    jsonrpc: { 
      type: 'string', 
      enum: ['2.0']
    },
    id: { 
      type: ['string', 'number', 'null']
    },
    result: { 
      description: 'Method result - can be any valid JSON value'
    },
    error: {
      type: 'object',
      properties: {
        code: { type: 'number' },
        message: { type: 'string' },
        data: { type: 'string' }
      },
      required: ['code', 'message']
    }
  },
  required: ['jsonrpc'],
  oneOf: [
    { required: ['result'] },
    { required: ['error'] }
  ]
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean', 
      default: false
    },
    error: { 
      type: 'string'
    }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces
interface JSONRPCMessage {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: string;
  };
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function mcpRoute(server: FastifyInstance) {
  // Get handlers from server instance (initialized in server.ts)
  const streamableHandler = (server as any).streamableHandler;
  const tokenIntrospectionService = (server as any).tokenIntrospectionService;

  if (!streamableHandler) {
    throw new Error('Streamable HTTP handler must be initialized before registering MCP routes');
  }

  if (!tokenIntrospectionService) {
    throw new Error('Token introspection service must be initialized before registering MCP routes');
  }

  // GET endpoint for SSE stream establishment
  server.get('/mcp', {
    preValidation: [
      requireAuthentication(tokenIntrospectionService),
      requireScope('mcp:read')
    ],
    schema: {
      tags: ['MCP Transport'],
      summary: 'Establish MCP SSE stream',
      description: 'Establishes a Server-Sent Events stream for MCP Streamable HTTP transport. Requires Accept: text/event-stream header.',
      headers: {
        type: 'object',
        properties: {
          'Accept': {
            type: 'string',
            enum: ['text/event-stream'],
            description: 'Must be text/event-stream for SSE'
          },
          'Mcp-Session-Id': {
            type: 'string',
            description: 'Optional session ID for resuming connections'
          }
        }
      },
      response: {
        200: {
          type: 'string',
          description: 'SSE stream with heartbeat messages',
          headers: {
            'Content-Type': { type: 'string', enum: ['text/event-stream'] },
            'Cache-Control': { type: 'string', enum: ['no-cache'] },
            'Connection': { type: 'string', enum: ['keep-alive'] }
          }
        },
        405: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Method Not Allowed - Missing Accept header'
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
        operation: 'mcp_get_route_accessed',
        userId: request.auth?.user.id,
        teamId: request.auth?.team.id,
        clientId: request.auth?.client_id,
        acceptHeader: request.headers.accept,
        sessionId: request.headers['mcp-session-id'],
        userAgent: request.headers['user-agent']
      }, 'Authenticated MCP GET route accessed');

      // Handle via streamable handler - this manages the response directly
      await streamableHandler.handleMcpEndpoint(request, reply);

    } catch (error) {
      server.log.error({
        operation: 'mcp_get_route_error',
        error: error instanceof Error ? error.message : String(error)
      }, 'MCP GET route error');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to establish MCP SSE stream'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  // POST endpoint for JSON-RPC messages
  server.post('/mcp', {
    preValidation: [
      requireAuthentication(tokenIntrospectionService),
      requireScope('mcp:tools:execute')
    ],
    schema: {
      tags: ['MCP Transport'],
      summary: 'Send MCP JSON-RPC message',
      description: 'Sends a JSON-RPC message via MCP Streamable HTTP transport. Supports both standard JSON and SSE streaming responses. Requires Content-Type: application/json header when sending request body.',
      headers: {
        type: 'object',
        properties: {
          'Accept': {
            type: 'string',
            description: 'Response format: application/json (default) or text/event-stream (streaming)'
          },
          'Mcp-Session-Id': {
            type: 'string',
            description: 'Optional session ID for session-based communication'
          }
        }
      },
      body: JSONRPC_MESSAGE_SCHEMA,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: JSONRPC_MESSAGE_SCHEMA
          }
        }
      },
      response: {
        200: {
          ...JSONRPC_RESPONSE_SCHEMA,
          description: 'JSON-RPC response or SSE stream'
        },
        400: {
          ...JSONRPC_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid JSON-RPC'
        },
        404: {
          ...JSONRPC_RESPONSE_SCHEMA,
          description: 'Session not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    const message = request.body as JSONRPCMessage;
    const sessionId = request.headers['mcp-session-id'] as string;
    const acceptHeader = request.headers.accept || '';

    server.log.info({
      operation: 'mcp_post_route_accessed',
      userId: request.auth?.user.id,
      teamId: request.auth?.team.id,
      clientId: request.auth?.client_id,
      method: message?.method,
      messageId: message?.id,
      sessionId: sessionId || 'none',
      acceptHeader,
      userAgent: request.headers['user-agent']
    }, 'Authenticated MCP POST route accessed');

    try {
      // Handle via streamable handler - this manages the response directly
      await streamableHandler.handleMcpEndpoint(request, reply);

    } catch (error) {
      server.log.error({
        operation: 'mcp_post_route_error',
        method: message?.method,
        messageId: message?.id,
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      }, 'MCP POST route error');

      const errorResponse: JSONRPCResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : String(error)
        },
        id: message?.id || null
      };

      // Increment session error count if session exists
      if (sessionId) {
        streamableHandler.incrementSessionErrorCount(sessionId);
      }

      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  // OPTIONS endpoint for CORS preflight
  server.options('/mcp', {
    schema: {
      tags: ['MCP Transport'],
      summary: 'MCP CORS preflight',
      description: 'Handles CORS preflight requests for MCP endpoint.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    server.log.debug({
      operation: 'mcp_options_route_accessed',
      origin: request.headers.origin,
      userAgent: request.headers['user-agent']
    }, 'MCP OPTIONS route accessed');

    // CORS headers are handled by @fastify/cors plugin
    const response = { status: 'ok' };
    const jsonString = JSON.stringify(response);
    return reply.status(200).type('application/json').send(jsonString);
  });
}
