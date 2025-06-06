import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { getDbStatus } from '../../db';
import { 
  DatabaseType,
  type DbStatusResponse,
  DbStatusResponseSchema
} from './schemas';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

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
    200: zodToJsonSchema(DbStatusResponseSchema.describe('Database status information'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error - Failed to fetch database status'), {
      $refStrategy: 'none',
      target: 'openApi3'
    })
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
    const responseStatus: DbStatusResponse = {
      configured: statusFromService.configured,
      initialized: statusFromService.initialized,
      dialect: statusFromService.dialect as DatabaseType | null,
    };
    return reply.send(responseStatus);
  } catch (error) {
    server.log.error(error, 'Error fetching database status'); // Use server.log
    return reply.status(500).send({ error: 'Failed to fetch database status' });
  }
}

// Fastify plugin to register the /api/db/status route
export default async function dbStatusRoute(server: FastifyInstance) {
  server.get(
    '/api/db/status',
    { schema: dbStatusRouteSchema },
    async (request, reply) => getDbStatusHandler(request, reply, server)
  );
}
