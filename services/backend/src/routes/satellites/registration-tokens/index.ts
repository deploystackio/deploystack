import { type FastifyInstance } from 'fastify';

// Import individual route files
import listAllTokens from './list';
import generateGlobalToken from './generate-global';
import generateTeamToken from './generate-team';
import listGlobalTokens from './list-global';
import listTeamTokens from './list-team';
import revokeToken from './revoke';

export default async function registrationTokenRoutes(server: FastifyInstance) {
  // Register all satellite registration token routes
  await server.register(listAllTokens);
  await server.register(generateGlobalToken);
  await server.register(generateTeamToken);
  await server.register(listGlobalTokens);
  await server.register(listTeamTokens);
  await server.register(revokeToken);
}
