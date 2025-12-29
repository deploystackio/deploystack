import { type FastifyInstance } from 'fastify';
import listUsersAdminRoute from './list';
import searchUsersAdminRoute from './search';
import getUserStatsAdminRoute from './stats';
import deleteUserAdminRoute from './delete';
import assignRoleAdminRoute from './assign-role';

export default async function adminUsersRoutes(server: FastifyInstance) {
  await server.register(listUsersAdminRoute);
  await server.register(searchUsersAdminRoute);
  await server.register(getUserStatsAdminRoute);
  await server.register(deleteUserAdminRoute);
  await server.register(assignRoleAdminRoute);
}
