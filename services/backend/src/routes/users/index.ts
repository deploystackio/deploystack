import type { FastifyInstance } from 'fastify';
import getUserByIdRoute from './getUserById';
import updateUserRoute from './updateUser';
import getCurrentUserRoute from './getCurrentUser';
import getCurrentUserTeamsRoute from './getCurrentUserTeams';
import deleteMyAccountRoute from './deleteMyAccount';
import getUserTeamsRoute from './getUserTeams';
import getMcpClientActivityRoute from './getMcpClientActivity';
import getMcpClientActivityStreamRoute from './getMcpClientActivityStream';
import preferencesRoutes from './preferences';
import satelliteRoutes from './satellite';
import metricsRoutes from './me/metrics';

export default async function usersRoute(server: FastifyInstance) {
  // Register individual user route handlers
  await server.register(getUserByIdRoute);
  await server.register(updateUserRoute);
  await server.register(getCurrentUserRoute);
  await server.register(getCurrentUserTeamsRoute);
  await server.register(deleteMyAccountRoute);
  await server.register(getUserTeamsRoute);
  await server.register(getMcpClientActivityRoute);
  await server.register(getMcpClientActivityStreamRoute);
  await server.register(preferencesRoutes);
  await server.register(satelliteRoutes);
  await server.register(metricsRoutes, { prefix: '/me/metrics' });
}
