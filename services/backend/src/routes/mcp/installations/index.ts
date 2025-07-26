import { type FastifyInstance } from 'fastify';
import createInstallationRoute from './create';
import listInstallationsRoute from './list';
import getInstallationRoute from './get';
import updateInstallationRoute from './update';
import updateEnvironmentVariablesRoute from './updateEnvironmentVars';
import getClientConfigRoute from './config';
import deleteInstallationRoute from './delete';

export default async function installationsRoutes(fastify: FastifyInstance) {
  // Register all installation routes
  await fastify.register(createInstallationRoute);
  await fastify.register(listInstallationsRoute);
  await fastify.register(getInstallationRoute);
  await fastify.register(updateInstallationRoute);
  await fastify.register(updateEnvironmentVariablesRoute);
  await fastify.register(getClientConfigRoute);
  await fastify.register(deleteInstallationRoute);
}
