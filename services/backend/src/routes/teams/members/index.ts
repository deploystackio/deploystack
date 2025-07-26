import type { FastifyInstance } from 'fastify';
import listTeamMembersRoute from './list';
import addTeamMemberRoute from './add';
import updateMemberRoleRoute from './updateRole';
import removeTeamMemberRoute from './remove';
import transferOwnershipRoute from './transferOwnership';

export default async function teamMembersRoutes(fastify: FastifyInstance) {
  // Register all team member management routes
  await fastify.register(listTeamMembersRoute);
  await fastify.register(addTeamMemberRoute);
  await fastify.register(updateMemberRoleRoute);
  await fastify.register(removeTeamMemberRoute);
  await fastify.register(transferOwnershipRoute);
}
