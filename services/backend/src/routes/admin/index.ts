import { type FastifyInstance } from 'fastify';
import emailRoutes from './email';
import jobsRoutes from './jobs';

export default async function adminRoutes(fastify: FastifyInstance) {
  await fastify.register(emailRoutes, { prefix: '/admin/email' });
  await fastify.register(jobsRoutes);
}
