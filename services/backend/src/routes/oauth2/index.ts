import { type FastifyInstance } from 'fastify';
import authorizationRoute from './authorization';
import tokenRoute from './token';
import consentRoute from './consent';
import userinfoRoute from './userinfo';
import introspectRoute from './introspect';
import discoveryRoute from './discovery';
import registerRoute from './register';

export default async function oauth2Routes(fastify: FastifyInstance) {
  await fastify.register(discoveryRoute);
  await fastify.register(registerRoute);
  await fastify.register(authorizationRoute);
  await fastify.register(tokenRoute);
  await fastify.register(consentRoute);
  await fastify.register(userinfoRoute);
  await fastify.register(introspectRoute);
}
