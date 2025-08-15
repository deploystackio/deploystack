import { type FastifyInstance } from 'fastify';
import getClientConfig from './config/get-client-config';

export default async function gatewayRoutes(server: FastifyInstance) {
  // Register gateway configuration routes
  await server.register(getClientConfig);
}
