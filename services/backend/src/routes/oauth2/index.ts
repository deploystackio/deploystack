import { type FastifyInstance } from 'fastify';
import authorizationRoute from './authorization';
import tokenRoute from './token';
import consentRoute from './consent';
import userinfoRoute from './userinfo';

export default async function oauth2Routes(fastify: FastifyInstance) {
  await fastify.register(authorizationRoute);
  await fastify.register(tokenRoute);
  await fastify.register(consentRoute);
  await fastify.register(userinfoRoute);
}
