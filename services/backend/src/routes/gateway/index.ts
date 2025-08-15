import { type FastifyInstance } from 'fastify';
import getClientConfig from './config/get-client-config';
import listClients from './config/list-clients';

export default async function gatewayRoutes(server: FastifyInstance) {
  // Register gateway configuration routes
  await server.register(getClientConfig);
  await server.register(listClients);
}
