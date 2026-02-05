import { type FastifyInstance } from 'fastify';
import listSatellitesRoute from './list';
import getSatelliteRoute from './get';
import updateSatelliteStatusRoute from './status';
import updateSatelliteRoute from './update';
import deleteSatelliteRoute from './delete';
import listSatelliteHeartbeatsRoute from './heartbeats';
import listSatelliteCommandsRoute from './commands';

export default async function satelliteManageRoutes(server: FastifyInstance) {
  // Register satellite management routes
  await server.register(listSatellitesRoute);
  await server.register(getSatelliteRoute);
  await server.register(updateSatelliteStatusRoute);
  await server.register(updateSatelliteRoute);
  await server.register(deleteSatelliteRoute);
  await server.register(listSatelliteHeartbeatsRoute);
  await server.register(listSatelliteCommandsRoute);
}
