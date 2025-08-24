import { type FastifyInstance } from 'fastify';
import getClientConfig from './config/get-client-config';
import listClients from './config/list-clients';
import meMcpConfigurations from './me-mcp-configurations';

export default async function gatewayRoutes(server: FastifyInstance) {
  // Register gateway configuration routes
  await server.register(getClientConfig);
  await server.register(listClients);
  await server.register(meMcpConfigurations);
}
