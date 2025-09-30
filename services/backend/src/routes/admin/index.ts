import { type FastifyInstance } from 'fastify';
import emailRoutes from './email';
import jobsRoutes from './jobs';
import mcpRegistryRoutes from './mcp-registry';

export default async function adminRoutes(fastify: FastifyInstance) {
  await fastify.register(emailRoutes, { prefix: '/admin/email' });
  await fastify.register(jobsRoutes);
  await fastify.register(mcpRegistryRoutes);
}
