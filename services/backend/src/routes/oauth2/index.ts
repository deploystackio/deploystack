import { type FastifyInstance } from 'fastify';
import authorizationRoute from './authorization';
import tokenRoute from './token';
import consentRoute from './consent';

export default async function oauth2Routes(fastify: FastifyInstance) {
  // Register OAuth2 routes
  await fastify.register(authorizationRoute);
  await fastify.register(tokenRoute);
  await fastify.register(consentRoute);
}
