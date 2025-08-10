import { type FastifyInstance } from 'fastify';
import testRoute from './test';

export default async function adminEmailRoutes(fastify: FastifyInstance) {
  await fastify.register(testRoute);
}
