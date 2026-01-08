import { type FastifyInstance } from 'fastify';
import authorizationRoute from './authorization';
import authorizeRoute from './authorize';
import tokenRoute from './token';
import consentRoute from './consent';
import userinfoRoute from './userinfo';
import introspectRoute from './introspect';
import discoveryRoute from './discovery';
import registerRoute from './register';

/**
 * OAuth2 Discovery Routes - MUST be mounted at root level (no /api prefix)
 * Per RFC 8414: Authorization servers MUST serve discovery metadata at root
 * Example: https://backend.url/.well-known/oauth-authorization-server
 */
export async function oauth2DiscoveryRoutes(fastify: FastifyInstance) {
  await fastify.register(discoveryRoute);
}

/**
 * OAuth2 API Routes - Mounted under /api prefix
 * These are the functional OAuth2 endpoints referenced in discovery metadata
 * Example: https://backend.url/api/oauth2/auth
 */
export async function oauth2ApiRoutes(fastify: FastifyInstance) {
  await fastify.register(registerRoute);
  await fastify.register(authorizationRoute);
  await fastify.register(authorizeRoute);
  await fastify.register(tokenRoute);
  await fastify.register(consentRoute);
  await fastify.register(userinfoRoute);
  await fastify.register(introspectRoute);
}

/**
 * @deprecated Legacy export for backward compatibility
 * Use oauth2DiscoveryRoutes and oauth2ApiRoutes instead
 */
export default async function oauth2Routes(fastify: FastifyInstance) {
  await fastify.register(discoveryRoute);
  await fastify.register(registerRoute);
  await fastify.register(authorizationRoute);
  await fastify.register(authorizeRoute);
  await fastify.register(tokenRoute);
  await fastify.register(consentRoute);
  await fastify.register(userinfoRoute);
  await fastify.register(introspectRoute);
}
