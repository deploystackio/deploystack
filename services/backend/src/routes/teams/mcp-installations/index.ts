import type { FastifyInstance } from 'fastify';
import getInstallationToolsRoute from './tools';

export default async function mcpInstallationsRoutes(fastify: FastifyInstance) {
  // Register tool metadata route
  await fastify.register(getInstallationToolsRoute);
}
