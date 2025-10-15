import { type FastifyInstance } from 'fastify';
import clientActivityRoute from './client-activity';

export default async function mcpMetricsRoutes(server: FastifyInstance) {
  await server.register(clientActivityRoute);
}
