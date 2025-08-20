import { FastifyInstance } from 'fastify';

// Import all route handlers
import createUserConfigurationRoute from './create';
import listUserConfigurationsRoute from './list';
import getUserConfigurationRoute from './get';
import updateUserConfigurationRoute from './update';
import deleteUserConfigurationRoute from './delete';
import updateUserArgsRoute from './updateArgs';
import updateUserEnvRoute from './updateEnv';

export default async function userConfigurationsRoutes(fastify: FastifyInstance) {
  // Register all user configuration routes
  await fastify.register(createUserConfigurationRoute);
  await fastify.register(listUserConfigurationsRoute);
  await fastify.register(getUserConfigurationRoute);
  await fastify.register(updateUserConfigurationRoute);
  await fastify.register(deleteUserConfigurationRoute);
  await fastify.register(updateUserArgsRoute);
  await fastify.register(updateUserEnvRoute);
}
