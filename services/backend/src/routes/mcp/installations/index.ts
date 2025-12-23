import { type FastifyInstance } from 'fastify';
import createInstallationRoute from './create';
import listInstallationsRoute from './list';
import listInstallationsStreamRoute from './list-stream';
import getInstallationRoute from './get';
import updateInstallationRoute from './update';
import updateEnvironmentVariablesRoute from './updateEnvironmentVars';
import updateHeadersRoute from './updateHeaders';
import updateQueryParamsRoute from './updateQueryParams';
import updateArgsRoute from './updateArgs';
import getClientConfigRoute from './config';
import deleteInstallationRoute from './delete';
import authorizeRoute from './authorize';
import callbackRoute from './callback';

export default async function installationsRoutes(fastify: FastifyInstance) {
  await fastify.register(createInstallationRoute);
  await fastify.register(listInstallationsRoute);
  await fastify.register(listInstallationsStreamRoute);
  await fastify.register(getInstallationRoute);
  await fastify.register(updateInstallationRoute);
  await fastify.register(updateEnvironmentVariablesRoute);
  await fastify.register(updateHeadersRoute);
  await fastify.register(updateQueryParamsRoute);
  await fastify.register(updateArgsRoute);
  await fastify.register(getClientConfigRoute);
  await fastify.register(deleteInstallationRoute);
  await fastify.register(authorizeRoute);
  await fastify.register(callbackRoute);
}
