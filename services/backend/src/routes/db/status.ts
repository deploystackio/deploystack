import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { getDbStatus } from '../../db';
import { 
  DbStatusResponseSchema
} from './schemas';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';

// Error response schema
const errorResponseSchema = z.object({
  error: z.string().describe('Error message describing what went wrong.')
});

// Route schema for OpenAPI documentation
const dbStatusRouteSchema = {
  tags: ['Database'],
  summary: 'Get database status',
  description: 'Returns the current status of the database configuration and initialization. This endpoint checks whether the database has been configured and properly initialized.',
  response: {
    200: createSchema(DbStatusResponseSchema.describe('Database status information')),
    500: createSchema(errorResponseSchema.describe('Internal Server Error - Failed to fetch database status'))
  }
};

// Handler for GET /api/db/status
async function getDbStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply,
  server: FastifyInstance // Added server instance for logging, consistent with other handlers
) {
  try {
    const statusFromService = getDbStatus();
    
    // Create a clean response object to avoid serialization issues
    const cleanResponse = {
      configured: Boolean(statusFromService.configured),
      initialized: Boolean(statusFromService.initialized),
      dialect: statusFromService.dialect ? String(statusFromService.dialect) : null
    };
    
    // Send as raw JSON string to bypass any serialization issues
    const jsonString = JSON.stringify(cleanResponse);
    server.log.info('Sending status response:', jsonString);
    return reply.type('application/json').send(jsonString);
  } catch (error) {
    server.log.error(error, 'Error fetching database status'); // Use server.log
    return reply.status(500).send({ error: 'Failed to fetch database status' });
  }
}

// Fastify plugin to register the /db/status route
export default async function dbStatusRoute(server: FastifyInstance) {
  server.get(
    '/db/status',
    { schema: dbStatusRouteSchema },
    async (request, reply) => getDbStatusHandler(request, reply, server)
  );
}
