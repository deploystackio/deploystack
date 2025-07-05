import { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

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
      description: 'Returns basic API health status for monitoring, load balancers, and uptime checks',
      response: {
        200: zodToJsonSchema(healthResponseSchema.describe('Simple health check response'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async () => {
    return { status: 'ok' }
  });
}
