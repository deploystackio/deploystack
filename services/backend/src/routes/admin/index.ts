import { type FastifyInstance } from 'fastify';
import emailRoutes from './email';
import jobsRoutes from './jobs';
import mcpRegistryRoutes from './mcp-registry';
import teamsRoutes from './teams';
import oauthProvidersRoutes from './oauth-providers';

export default async function adminRoutes(fastify: FastifyInstance) {
  await fastify.register(emailRoutes, { prefix: '/admin/email' });
  await fastify.register(jobsRoutes);
  await fastify.register(mcpRegistryRoutes);
  await fastify.register(teamsRoutes, { prefix: '/admin' });
  await fastify.register(oauthProvidersRoutes, { prefix: '/admin' });
}
