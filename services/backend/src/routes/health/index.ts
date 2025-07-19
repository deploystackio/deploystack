import { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createSchema } from 'zod-openapi'

// Response schema for the simple health check endpoint
const healthResponseSchema = z.object({
  status: z.literal('ok').describe('Health status indicator')
});

export default async function healthRoute(server: FastifyInstance) {
  // Simple health check endpoint for monitoring/load balancers
  server.get('/health', {
    schema: {
      tags: ['Health Check'],
      summary: 'Simple API health check',
      description: 'Returns basic API health status for monitoring, load balancers, and uptime checks. No Content-Type header required for this GET request.',
      response: {
        200: createSchema(healthResponseSchema.describe('Simple health check response'))
      }
    }
  }, async () => {
    return { status: 'ok' }
  });
}
