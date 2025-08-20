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
import preferencesRoutes from './preferences';
import userDevicesRoute from './me/devices';

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
  
  // Register preferences routes
  await server.register(preferencesRoutes);
  
  // Register device management routes
  await server.register(userDevicesRoute);
}
