/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyInstance } from 'fastify';

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

const MESSAGE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    status: { 
      type: 'string',
      description: 'Message processing status'
    },
    messageId: { 
      type: ['string', 'number', 'null'],
      description: 'Original message ID'
    }
  },
  required: ['status']
} as const;

const JSONRPC_ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    jsonrpc: { 
      type: 'string', 
      enum: ['2.0']
    },
    error: {
      type: 'object',
      properties: {
        code: { type: 'number' },
        message: { type: 'string' },
        data: { type: 'string' }
      },
      required: ['code', 'message']
    },
    id: { 
      type: ['string', 'number', 'null']
    }
  },
  required: ['jsonrpc', 'error']
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

interface MessageSuccessResponse {
  status: string;
  messageId?: string | number | null;
}

interface JSONRPCErrorResponse {
  jsonrpc: '2.0';
  error: {
    code: number;
    message: string;
    data?: string;
  };
  id: string | number | null;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function messageRoute(server: FastifyInstance) {
  server.post('/message', {
    schema: {
      tags: ['MCP Transport'],
      summary: 'Send JSON-RPC message via SSE',
      description: 'Sends a JSON-RPC message to an established SSE session. Requires Content-Type: application/json header when sending request body.',
      querystring: {
        type: 'object',
        properties: {
          session: {
            type: 'string',
            minLength: 32,
            description: 'Session ID obtained from SSE connection'
          }
        },
        required: ['session'],
        additionalProperties: false
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
          ...MESSAGE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Message sent successfully'
        },
        202: {
          ...MESSAGE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Message accepted (for notifications)'
        },
        400: {
          ...JSONRPC_ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid JSON-RPC or missing session'
        },
        404: {
          ...JSONRPC_ERROR_RESPONSE_SCHEMA,
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
    const query = request.query as { session: string };
    const sessionId = query.session;

    server.log.info({
      operation: 'message_route_accessed',
      sessionId,
      method: message?.method,
      messageId: message?.id,
      userAgent: request.headers['user-agent']
    }, 'Message route accessed');

    if (!sessionId) {
      const errorResponse: JSONRPCErrorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Missing session parameter'
        },
        id: message?.id || null
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(400).type('application/json').send(jsonString);
    }

    // Get session manager from server instance
    const sessionManager = (server as any).sessionManager;
    const sseHandler = (server as any).sseHandler;

    if (!sessionManager || !sseHandler) {
      server.log.error({
        operation: 'message_route_handlers_missing',
        sessionId
      }, 'Session manager or SSE handler not found');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Internal server error: handlers not initialized'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }

    // Validate session exists
    if (!sessionManager.getSession(sessionId)) {
      const errorResponse: JSONRPCErrorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Session not found'
        },
        id: message?.id || null
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(404).type('application/json').send(jsonString);
    }

    try {
      // Update session activity
      sessionManager.updateActivity(sessionId);

      // Process the JSON-RPC message
      let response: any;

      // Handle different MCP methods
      if (message.method === 'initialize') {
        response = await handleInitialize(message, sessionId, server);
      } else if (message.method === 'notifications/initialized') {
        // Handle initialized notification - no response needed for notifications
        server.log.info({
          operation: 'mcp_client_initialized',
          sessionId
        }, 'MCP client initialized');

        const successResponse: MessageSuccessResponse = {
          status: 'accepted',
          messageId: message.id
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(202).type('application/json').send(jsonString);
      } else if (message.method === 'tools/list') {
        response = await handleToolsList(message, server);
      } else if (message.method === 'tools/call') {
        response = await handleToolCall(message, server);
      } else if (message.method === 'resources/list') {
        response = await handleResourcesList(message, server);
      } else if (message.method === 'resources/templates/list') {
        response = await handleResourceTemplatesList(message, server);
      } else if (message.method === 'prompts/list') {
        response = await handlePromptsList(message, server);
      } else {
        // Unknown method
        response = {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: ${message.method}`
          },
          id: message.id || null
        };
      }

      // Send response via SSE
      const success = sseHandler.sendMessage(sessionId, response);
      
      if (success) {
        const successResponse: MessageSuccessResponse = {
          status: 'sent',
          messageId: message.id
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);
      } else {
        const errorResponse: JSONRPCErrorResponse = {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Failed to send message via SSE'
          },
          id: message.id || null
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }

    } catch (error) {
      server.log.error({
        operation: 'message_route_error',
        sessionId,
        method: message?.method,
        error: error instanceof Error ? error.message : String(error)
      }, 'Message route error');
      
      const errorResponse: JSONRPCErrorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : String(error)
        },
        id: message?.id || null
      };

      // Try to send error via SSE, fallback to HTTP response
      const success = sseHandler.sendError(sessionId, errorResponse);
      
      if (!success) {
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      } else {
        const successResponse: MessageSuccessResponse = {
          status: 'error_sent',
          messageId: message?.id || null
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  });
}

/**
 * Handle MCP initialize request
 */
async function handleInitialize(message: JSONRPCMessage, sessionId: string, server: FastifyInstance): Promise<any> {
  const sessionManager = (server as any).sessionManager;
  
  // Store client info if provided
  if (message.params?.clientInfo) {
    sessionManager.setClientInfo(sessionId, message.params.clientInfo);
  }
  
  // Mark session as initialized
  sessionManager.setMcpInitialized(sessionId);

  return {
    jsonrpc: '2.0',
    id: message.id,
    result: {
      serverInfo: {
        name: 'deploystack-satellite',
        version: '1.0.0'
      },
      protocolVersion: '2025-03-26',
      capabilities: {
        tools: { listChanged: false },
        resources: {},
        prompts: {}
      }
    }
  };
}

/**
 * Handle tools/list request - return empty tools for now
 */
async function handleToolsList(message: JSONRPCMessage, server: FastifyInstance): Promise<any> {
  server.log.debug({
    operation: 'tools_list_requested',
    messageId: message.id
  }, 'Tools list requested');

  return {
    jsonrpc: '2.0',
    id: message.id,
    result: {
      tools: []
    }
  };
}

/**
 * Handle tools/call request - return not implemented for now
 */
async function handleToolCall(message: JSONRPCMessage, server: FastifyInstance): Promise<any> {
  const toolName = (message.params as any)?.name;
  
  server.log.debug({
    operation: 'tool_call_requested',
    messageId: message.id,
    toolName
  }, 'Tool call requested');

  return {
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: `Tool not found: ${toolName || 'unknown'}`
    },
    id: message.id
  };
}

/**
 * Handle resources/list request - return empty resources for now
 */
async function handleResourcesList(message: JSONRPCMessage, _server: FastifyInstance): Promise<any> {
  return {
    jsonrpc: '2.0',
    id: message.id,
    result: {
      resources: []
    }
  };
}

/**
 * Handle resources/templates/list request - return empty templates for now
 */
async function handleResourceTemplatesList(message: JSONRPCMessage, _server: FastifyInstance): Promise<any> {
  return {
    jsonrpc: '2.0',
    id: message.id,
    result: {
      resourceTemplates: []
    }
  };
}

/**
 * Handle prompts/list request - return empty prompts for now
 */
async function handlePromptsList(message: JSONRPCMessage, _server: FastifyInstance): Promise<any> {
  return {
    jsonrpc: '2.0',
    id: message.id,
    result: {
      prompts: []
    }
  };
}
