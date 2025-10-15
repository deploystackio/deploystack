import { type FastifyInstance } from 'fastify';
import mcpMetricsRoutes from './mcp';

export default async function metricsRoutes(server: FastifyInstance) {
  await server.register(mcpMetricsRoutes, { prefix: '/mcp' });
}
