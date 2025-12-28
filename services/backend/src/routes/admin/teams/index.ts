import { type FastifyInstance } from 'fastify';
import listTeamsAdminRoute from './list';
import searchTeamsAdminRoute from './search';
import getTeamAdminRoute from './get';
import updateTeamAdminRoute from './update';
import getTeamMcpInstallationsAdminRoute from './mcp-installations';

export default async function adminTeamsRoutes(server: FastifyInstance) {
  await server.register(listTeamsAdminRoute);
  await server.register(searchTeamsAdminRoute);
  await server.register(getTeamAdminRoute);
  await server.register(updateTeamAdminRoute);
  await server.register(getTeamMcpInstallationsAdminRoute);
}
