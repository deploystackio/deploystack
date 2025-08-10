import { type FastifyInstance } from 'fastify';
import emailRoutes from './email';

export default async function adminRoutes(fastify: FastifyInstance) {
  await fastify.register(emailRoutes, { prefix: '/admin/email' });
}
