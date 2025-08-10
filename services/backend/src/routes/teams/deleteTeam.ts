import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createSchema } from 'zod-openapi';
import { TeamService } from '../../services/teamService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { ErrorResponseSchema } from './schemas';

export default async function deleteTeamRoute(fastify: FastifyInstance) {
  // DELETE /teams/:id - Delete team
  fastify.delete<{ Params: { id: string } }>('/teams/:id', {
    schema: {
      tags: ['Teams'],
      summary: 'Delete team',
      description: 'Deletes a team from the system. Only team owners can delete teams. Default teams cannot be deleted.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success', 'message']
        },
        400: createSchema(ErrorResponseSchema.describe('Bad Request - Cannot delete default team or team has active resources')),
        401: createSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(ErrorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(ErrorResponseSchema.describe('Not Found - Team not found')),
        500: createSchema(ErrorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requirePermission('teams.delete'),
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const teamId = request.params.id;

      // Check if team exists
      const existingTeam = await TeamService.getTeamById(teamId);
      if (!existingTeam) {
        return reply.status(404).send({
          success: false,
          error: 'Team not found',
        });
      }

      // Check if user is team owner
      if (existingTeam.owner_id !== request.user.id) {
        return reply.status(403).send({
          success: false,
          error: 'Only team owners can delete teams',
        });
      }

      // Check if it's a default team
      if (existingTeam.is_default) {
        return reply.status(400).send({
          success: false,
          error: 'Default teams cannot be deleted',
        });
      }

      // Delete the team
      await TeamService.deleteTeam(teamId);

      return reply.status(200).send({
        success: true,
        message: 'Team deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('active resources')) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot delete team with active resources',
        });
      }

      fastify.log.error(error, 'Error deleting team');
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete team',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
