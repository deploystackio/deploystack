import { type FastifyInstance } from 'fastify';
import clientActivityRoute from './client-activity';
import clientActivityStreamRoute from './client-activity-stream';

export default async function mcpMetricsRoutes(server: FastifyInstance) {
  await server.register(clientActivityRoute);
  await server.register(clientActivityStreamRoute);
}
