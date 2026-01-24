import type { FastifyInstance } from 'fastify';
import deployGitHubRoutes from './github';
import deployRoutes from './deploy';

/**
 * Deployment Routes (GitHub Integration)
 *
 * Current Implementation (Phase 3):
 * - GitHub App integration for repository access
 * - Repository and branch browsing
 * - Deployment endpoint stub (full implementation in Phase 4)
 *
 * Phase 4 will add:
 * - Synchronous deployment flow (no job queue)
 * - Direct MCP server creation from GitHub repositories
 * - Real-time deployment status
 */
export default async function deploymentRoutes(server: FastifyInstance) {
  // Always register all deployment routes
  // Each individual route will check if deployment.enabled is true
  await server.register(deployGitHubRoutes);
  await server.register(deployRoutes);
}
