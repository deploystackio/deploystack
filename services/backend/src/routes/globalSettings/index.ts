import type { FastifyInstance } from 'fastify';

// Import all route modules
import listSettingsRoute from './settings/list';
import getSettingRoute from './settings/get';
import createSettingRoute from './settings/create';
import updateSettingRoute from './settings/update';
import deleteSettingRoute from './settings/delete';
import searchSettingsRoute from './settings/search';
import bulkSettingsRoute from './settings/bulk';

import listGroupsRoute from './groups/list';
import getGroupSettingsRoute from './groups/get';

import listCategoriesRoute from './categories/list';

import healthCheckRoute from './health/check';
import githubTestConnectionRoute from './github/test-connection';

export default async function globalSettingsRoute(fastify: FastifyInstance) {
  // Register all settings routes
  await fastify.register(listSettingsRoute);
  await fastify.register(getSettingRoute);
  await fastify.register(createSettingRoute);
  await fastify.register(updateSettingRoute);
  await fastify.register(deleteSettingRoute);
  await fastify.register(searchSettingsRoute);
  await fastify.register(bulkSettingsRoute);

  // Register groups routes
  await fastify.register(listGroupsRoute);
  await fastify.register(getGroupSettingsRoute);

  // Register categories routes
  await fastify.register(listCategoriesRoute);

  // Register health routes
  await fastify.register(healthCheckRoute);

  // Register GitHub routes
  await fastify.register(githubTestConnectionRoute);
}
