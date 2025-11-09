import { type FastifyInstance } from 'fastify';
import updateTeamAdminRoute from './update';

export default async function adminTeamsRoutes(server: FastifyInstance) {
  await server.register(updateTeamAdminRoute);
}
