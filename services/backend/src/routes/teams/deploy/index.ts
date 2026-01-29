import type { FastifyInstance } from 'fastify';
import deployGitHubRoutes from './github';
import deployRoutes from './deploy';
import validateRoutes from './validate';

/**
 * Deployment Routes (GitHub Integration)
 *
 * Routes:
 * - GitHub App integration for repository access
 * - Repository and branch browsing
 * - Validation endpoint (lightweight repository validation)
 * - Deployment endpoint (full deployment with database creation)
 */
export default async function deploymentRoutes(server: FastifyInstance) {
  // Always register all deployment routes
  // Each individual route will check if deployment.enabled is true
  await server.register(deployGitHubRoutes);
  await server.register(validateRoutes);
  await server.register(deployRoutes);
}
