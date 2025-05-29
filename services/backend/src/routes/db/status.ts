import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { getDbStatus } from '../../db';
import { 
  DatabaseType,
  type DbStatusResponse
  // DbStatusResponseSchema // Not strictly needed for handler logic unless validating response here
} from './schemas';

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
    // Optional: Add response schema for validation if desired
    // { schema: { response: { 200: DbStatusResponseSchema } } },
    async (request, reply) => getDbStatusHandler(request, reply, server)
  );
}
