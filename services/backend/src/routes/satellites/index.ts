import { type FastifyInstance } from 'fastify';
import satelliteCommandsRoute from './commands';
import satelliteHeartbeatRoute from './heartbeat';
import satelliteConfigRoute from './config';
import satelliteRegisterRoute from './register';
import satelliteManageRoutes from './manage';

export default async function satellitesRoute(server: FastifyInstance) {
  await server.register(satelliteRegisterRoute);
  await server.register(satelliteCommandsRoute);
  await server.register(satelliteHeartbeatRoute);
  await server.register(satelliteConfigRoute);
  await server.register(satelliteManageRoutes);
}
