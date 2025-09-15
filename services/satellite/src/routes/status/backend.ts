import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BackendClient } from '../../services/backend-client';

const backendStatusSchema = {
  tags: ['Status'],
  summary: 'Get backend connection status',
  description: 'Test and return the current connection status to the DeployStack backend',
  response: {
    200: {
      type: 'object',
      properties: {
        backend_url: { type: 'string' },
        connection_status: { 
          type: 'string', 
          enum: ['connected', 'disconnected', 'error'] 
        },
        last_check: { type: 'string', format: 'date-time' },
        response_time_ms: { type: 'number' },
        error_message: { type: 'string' }
      },
      required: ['backend_url', 'connection_status', 'last_check']
    }
  }
};

export async function registerBackendStatusRoutes(server: FastifyInstance) {
  // Get backend client from server instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const backendClient = (server as any).backendClient as BackendClient;

  if (!backendClient) {
    server.log.error('BackendClient not found on server instance');
    throw new Error('BackendClient not initialized');
  }

  server.get('/api/status/backend', {
    schema: backendStatusSchema
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.info({
      operation: 'backend_status_check',
      endpoint: '/api/status/backend'
    }, 'Backend status check requested');

    try {
      // Test connection to backend
      const status = await backendClient.testConnection();

      request.log.info({
        operation: 'backend_status_response',
        connection_status: status.connection_status,
        response_time_ms: status.response_time_ms
      }, 'Backend status check completed');

      return reply.code(200).send(status);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      request.log.error({
        operation: 'backend_status_error',
        error: errorMessage
      }, 'Backend status check failed');

      // Return error status
      const errorStatus = {
        backend_url: backendClient.getBackendUrl(),
        connection_status: 'error' as const,
        last_check: new Date().toISOString(),
        error_message: errorMessage
      };

      return reply.code(200).send(errorStatus);
    }
  });

  server.log.info({
    operation: 'routes_registered',
    routes: ['/api/status/backend']
  }, 'Backend status routes registered');
}
