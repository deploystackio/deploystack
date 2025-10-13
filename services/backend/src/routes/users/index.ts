import type { FastifyInstance } from 'fastify';
import listUsersRoute from './listUsers';
import getUserByIdRoute from './getUserById';
import updateUserRoute from './updateUser';
import deleteUserRoute from './deleteUser';
import assignRoleRoute from './assignRole';
import getUserStatsRoute from './getUserStats';
import getUsersByRoleRoute from './getUsersByRole';
import getCurrentUserRoute from './getCurrentUser';
import getCurrentUserTeamsRoute from './getCurrentUserTeams';
import getUserTeamsRoute from './getUserTeams';
import getMcpClientActivityRoute from './getMcpClientActivity';
import preferencesRoutes from './preferences';
import satelliteRoutes from './satellite';

export default async function usersRoute(server: FastifyInstance) {
  // Register individual user route handlers
  await server.register(listUsersRoute);
  await server.register(getUserByIdRoute);
  await server.register(updateUserRoute);
  await server.register(deleteUserRoute);
  await server.register(assignRoleRoute);
  await server.register(getUserStatsRoute);
  await server.register(getUsersByRoleRoute);
  await server.register(getCurrentUserRoute);
  await server.register(getCurrentUserTeamsRoute);
  await server.register(getUserTeamsRoute);
  await server.register(getMcpClientActivityRoute);
  await server.register(preferencesRoutes);
  await server.register(satelliteRoutes);
}
