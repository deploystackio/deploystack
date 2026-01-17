import type { FastifyInstance } from 'fastify';
import getInstallationToolsRoute from './tools';
import getTeamMcpToolsStatsRoute from './stats';
import toggleToolRoute from './toggle-tool';
import batchToggleToolsRoute from './batch-toggle-tools';
import getInstallationStatusRoute from './status';
import getInstallationStatusStreamRoute from './status-stream';
import getInstallationInstancesRoute from './instances';
import getInstallationLogsRoute from './logs';
import getInstallationRequestsRoute from './requests';
import getRequestByIdRoute from './request-by-id';
import updateInstallationSettingsRoute from './settings';
import getInstallationLogsStreamRoute from './logs-stream';
import getInstallationRequestsStreamRoute from './requests-stream';

export default async function mcpInstallationsRoutes(fastify: FastifyInstance) {
  await fastify.register(getInstallationToolsRoute);
  await fastify.register(getTeamMcpToolsStatsRoute);
  await fastify.register(toggleToolRoute);
  await fastify.register(batchToggleToolsRoute);
  await fastify.register(getInstallationStatusRoute);
  await fastify.register(getInstallationStatusStreamRoute);
  await fastify.register(getInstallationInstancesRoute);
  await fastify.register(getInstallationLogsRoute);
  await fastify.register(getInstallationRequestsRoute);
  await fastify.register(getRequestByIdRoute);
  await fastify.register(updateInstallationSettingsRoute);
  await fastify.register(getInstallationLogsStreamRoute);
  await fastify.register(getInstallationRequestsStreamRoute);
}
