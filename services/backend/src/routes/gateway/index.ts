import { type FastifyInstance } from 'fastify';
import meMcpConfigurations from './me-mcp-configurations';

export default async function gatewayRoutes(server: FastifyInstance) {
  // Register remaining gateway route for backward compatibility during transition
  await server.register(meMcpConfigurations);
  
  // NOTE: Gateway config routes moved to /api/users/me/satellite/* as part of strategic pivot
  // - /gateway/config/:client -> /users/me/satellite/config/:client
  // - /gateway/config/clients -> /users/me/satellite/clients
}
