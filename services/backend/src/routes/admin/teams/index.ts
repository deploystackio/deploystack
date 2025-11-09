import { type FastifyInstance } from 'fastify';
import listTeamsAdminRoute from './list';
import getTeamAdminRoute from './get';
import updateTeamAdminRoute from './update';

export default async function adminTeamsRoutes(server: FastifyInstance) {
  await server.register(listTeamsAdminRoute);
  await server.register(getTeamAdminRoute);
  await server.register(updateTeamAdminRoute);
}
