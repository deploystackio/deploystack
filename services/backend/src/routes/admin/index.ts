import { type FastifyInstance } from 'fastify';
import emailRoutes from './email';
import jobsRoutes from './jobs';
import mcpRegistryRoutes from './mcp-registry';
import mcpRoutes from './mcp';
import teamsRoutes from './teams';
import usersRoutes from './users';
import oauthProvidersRoutes from './oauth-providers';

export default async function adminRoutes(fastify: FastifyInstance) {
  await fastify.register(emailRoutes, { prefix: '/admin/email' });
  await fastify.register(jobsRoutes);
  await fastify.register(mcpRegistryRoutes);
  await fastify.register(mcpRoutes, { prefix: '/admin/mcp' });
  await fastify.register(teamsRoutes, { prefix: '/admin' });
  await fastify.register(usersRoutes, { prefix: '/admin' });
  await fastify.register(oauthProvidersRoutes, { prefix: '/admin' });
}
