import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { createSchema } from 'zod-openapi';
import { TeamService } from '../../services/teamService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { UpdateTeamSchema, TeamResponseSchema, ErrorResponseSchema, type UpdateTeamInput } from './schemas';

export default async function updateTeamRoute(fastify: FastifyInstance) {
  // PUT /teams/:id - Update team
  fastify.put<{ Params: { id: string }; Body: UpdateTeamInput }>('/teams/:id', {
    schema: {
      tags: ['Teams'],
      summary: 'Update team',
      description: 'Updates an existing team. Only team admins can update teams. Default team names cannot be changed.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: createSchema(UpdateTeamSchema),
      response: {
        200: createSchema(TeamResponseSchema.describe('Team updated successfully')),
        400: createSchema(ErrorResponseSchema.describe('Bad Request - Validation error or cannot update default team name')),
        401: createSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(ErrorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(ErrorResponseSchema.describe('Not Found - Team not found')),
        500: createSchema(ErrorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requirePermission('teams.edit'),
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateTeamInput }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const teamId = request.params.id;
      const validatedData = UpdateTeamSchema.parse(request.body);

      // Check if team exists
      const existingTeam = await TeamService.getTeamById(teamId);
      if (!existingTeam) {
        return reply.status(404).send({
          success: false,
          error: 'Team not found',
        });
      }

      // Check if user is team admin
      const isTeamAdmin = await TeamService.isTeamAdmin(teamId, request.user.id);
      if (!isTeamAdmin) {
        return reply.status(403).send({
          success: false,
          error: 'Only team administrators can update teams',
        });
      }

      // Check if trying to update default team name
      if (existingTeam.is_default && validatedData.name && validatedData.name !== existingTeam.name) {
        return reply.status(400).send({
          success: false,
          error: 'Default team names cannot be changed',
        });
      }

      // Update the team
      const updatedTeam = await TeamService.updateTeam(teamId, validatedData);

      return reply.status(200).send({
        success: true,
        data: updatedTeam,
        message: 'Team updated successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.issues,
        });
      }

      fastify.log.error(error, 'Error updating team');
      return reply.status(500).send({
        success: false,
        error: 'Failed to update team',
      });
    }
  });
}
