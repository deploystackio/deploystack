import { type FastifyInstance } from 'fastify';
import getTeamsByServerRoute from './servers/teams-by-server';

export default async function adminMcpRoutes(server: FastifyInstance) {
  await server.register(getTeamsByServerRoute);
}
