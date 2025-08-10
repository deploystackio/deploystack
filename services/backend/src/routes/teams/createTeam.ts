import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { createSchema } from 'zod-openapi';
import { TeamService } from '../../services/teamService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { CreateTeamSchema, TeamResponseSchema, ErrorResponseSchema, type CreateTeamInput } from './schemas';

export default async function createTeamRoute(fastify: FastifyInstance) {
  // POST /teams - Create a new team
  fastify.post<{ Body: CreateTeamInput }>('/teams', {
    schema: {
      tags: ['Teams'],
      summary: 'Create new team',
      description: 'Creates a new team with the specified name and description. Users can create up to 3 teams maximum. The slug is automatically generated from the team name and made unique.',
      security: [{ cookieAuth: [] }],
      body: createSchema(CreateTeamSchema),
      response: {
        201: createSchema(TeamResponseSchema.describe('Team created successfully')),
        400: createSchema(ErrorResponseSchema.describe('Bad Request - Validation error or team limit reached')),
        401: createSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(ErrorResponseSchema.describe('Forbidden - Insufficient permissions')),
        500: createSchema(ErrorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requirePermission('teams.create'),
  }, async (request: FastifyRequest<{ Body: CreateTeamInput }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      // Validate request body
      const validatedData = CreateTeamSchema.parse(request.body);

      // Check if user can create more teams (3 team limit)
      const canCreate = await TeamService.canUserCreateTeam(request.user.id);
      if (!canCreate) {
        return reply.status(400).send({
          success: false,
          error: 'You have reached the maximum limit of 3 teams',
        });
      }

      // Create the team
      const team = await TeamService.createTeam({
        name: validatedData.name,
        description: validatedData.description,
        owner_id: request.user.id,
      });

      return reply.status(201).send({
        success: true,
        data: team,
        message: 'Team created successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.issues,
        });
      }

      if (error instanceof Error) {
        // Handle specific team creation errors
        if (error.message.includes('slug')) {
          return reply.status(400).send({
            success: false,
            error: 'Team name conflicts with existing team',
          });
        }
      }

      fastify.log.error(error, 'Error creating team');
      return reply.status(500).send({
        success: false,
        error: 'Failed to create team',
      });
    }
  });
}
