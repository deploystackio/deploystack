import { type FastifyInstance } from 'fastify';
import listDevicesRoute from './list';
import getDeviceRoute from './get';
import updateDeviceRoute from './update';
import deleteDeviceRoute from './delete';

export default async function userDevicesRoutes(server: FastifyInstance) {
  // Register individual route modules
  await server.register(listDevicesRoute);
  await server.register(getDeviceRoute);
  await server.register(updateDeviceRoute);
  await server.register(deleteDeviceRoute);
}
