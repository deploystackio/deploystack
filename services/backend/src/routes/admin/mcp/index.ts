import { type FastifyInstance } from 'fastify';
import getTeamsByServerRoute from './servers/teams-by-server';
import searchTeamsByServerRoute from './servers/teams-search';

export default async function adminMcpRoutes(server: FastifyInstance) {
  await server.register(getTeamsByServerRoute);
  await server.register(searchTeamsByServerRoute);
}
