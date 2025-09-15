import { type FastifyInstance } from 'fastify';
import listSatellitesRoute from './list';
import updateSatelliteStatusRoute from './status';

export default async function satelliteManageRoutes(server: FastifyInstance) {
  // Register satellite management routes
  await server.register(listSatellitesRoute);
  await server.register(updateSatelliteStatusRoute);
}
