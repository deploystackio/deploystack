import type { FastifyInstance } from 'fastify';
import listRolesRoute from './listRoles';
import getRoleByIdRoute from './getRoleById';
import createRoleRoute from './createRole';
import updateRoleRoute from './updateRole';
import deleteRoleRoute from './deleteRole';
import getPermissionsRoute from './getPermissions';

export default async function rolesRoute(server: FastifyInstance) {
  // Register individual role route handlers
  await server.register(listRolesRoute);
  await server.register(getRoleByIdRoute);
  await server.register(createRoleRoute);
  await server.register(updateRoleRoute);
  await server.register(deleteRoleRoute);
  await server.register(getPermissionsRoute);
}
