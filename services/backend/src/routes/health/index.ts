import { type FastifyInstance } from 'fastify';

// Reusable Schema Constants
const HEALTH_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    status: { 
      type: 'string',
      enum: ['ok'],
      description: 'Health status indicator'
    }
  },
  required: ['status']
} as const;

// TypeScript interface
interface HealthResponse {
  status: 'ok';
}

export default async function healthRoute(server: FastifyInstance) {
  // Simple health check endpoint for monitoring/load balancers
  server.get('/health', {
    schema: {
      tags: ['Health Check'],
      summary: 'Simple API health check',
      description: 'Returns basic API health status for monitoring, load balancers, and uptime checks. No Content-Type header required for this GET request.',
      response: {
        200: {
          ...HEALTH_RESPONSE_SCHEMA,
          description: 'Simple health check response'
        }
      }
    }
  }, async (request, reply) => {
    const healthResponse: HealthResponse = { status: 'ok' };
    const jsonString = JSON.stringify(healthResponse);
    return reply.status(200).type('application/json').send(jsonString);
  });
}
