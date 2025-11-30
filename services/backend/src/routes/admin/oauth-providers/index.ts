import { type FastifyInstance } from 'fastify';
import listProvidersRoute from './list';
import createProviderRoute from './create';
import getProviderRoute from './get';
import updateProviderRoute from './update';
import deleteProviderRoute from './delete';

export default async function adminOAuthProvidersRoutes(server: FastifyInstance) {
  await server.register(listProvidersRoute);
  await server.register(createProviderRoute);
  await server.register(getProviderRoute);
  await server.register(updateProviderRoute);
  await server.register(deleteProviderRoute);
}
