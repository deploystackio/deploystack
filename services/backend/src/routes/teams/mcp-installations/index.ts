import type { FastifyInstance } from 'fastify';
import getInstallationToolsRoute from './tools';
import getTeamMcpToolsStatsRoute from './stats';
import toggleToolRoute from './toggle-tool';

export default async function mcpInstallationsRoutes(fastify: FastifyInstance) {
  // Register tool metadata route
  await fastify.register(getInstallationToolsRoute);

  // Register team MCP tools statistics route
  await fastify.register(getTeamMcpToolsStatsRoute);

  // Register tool toggle (enable/disable) route
  await fastify.register(toggleToolRoute);
}
