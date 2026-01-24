import type { FastifyInstance } from 'fastify';
import getDefaultTeamRoute from './getDefaultTeam';
import getUserTeamsRoute from './getUserTeams';
import getTeamByIdRoute from './getTeamById';
import createTeamRoute from './createTeam';
import updateTeamRoute from './updateTeam';
import deleteTeamRoute from './deleteTeam';
import getTeamUsageRoute from './usage';
import teamMembersRoutes from './members';
import mcpInstallationsRoutes from './mcp-installations';
import getTeamSatellitesRoute from './satellites';
import deploymentRoutes from './deploy';

export default async function teamsRoute(fastify: FastifyInstance) {
  // Register individual team route handlers
  await fastify.register(getDefaultTeamRoute);
  await fastify.register(getUserTeamsRoute);
  await fastify.register(getTeamByIdRoute);
  await fastify.register(createTeamRoute);
  await fastify.register(updateTeamRoute);
  await fastify.register(deleteTeamRoute);
  await fastify.register(getTeamUsageRoute);

  // Register team member management routes
  await fastify.register(teamMembersRoutes);

  // Register MCP installations routes
  await fastify.register(mcpInstallationsRoutes);

  // Register team satellites routes
  await fastify.register(getTeamSatellitesRoute);

  // Register deployment routes
  await fastify.register(deploymentRoutes);
}
