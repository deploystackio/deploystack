import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TeamService } from '../../services/teamService';
import { requirePermission } from '../../middleware/roleMiddleware';
import {
  CreateTeamSchema,
  TeamResponseSchema,
  TeamsListResponseSchema,
  ErrorResponseSchema,
  type CreateTeamInput,
} from './schemas';

export default async function teamsRoute(fastify: FastifyInstance) {
  // POST /api/teams - Create a new team
  fastify.post<{ Body: CreateTeamInput }>('/api/teams', {
    schema: {
      tags: ['Teams'],
      summary: 'Create new team',
      description: 'Creates a new team with the specified name and description. Users can create up to 3 teams maximum. The slug is automatically generated from the team name and made unique.',
      security: [{ cookieAuth: [] }],
      body: zodToJsonSchema(CreateTeamSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        201: zodToJsonSchema(TeamResponseSchema.describe('Team created successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(ErrorResponseSchema.describe('Bad Request - Validation error or team limit reached'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(ErrorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(ErrorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('teams.create'),
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
          details: error.errors,
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

  // GET /api/teams/me - Get current user's teams (alternative endpoint)
  fastify.get('/api/teams/me', {
    schema: {
      tags: ['Teams'],
      summary: 'Get current user teams',
      description: 'Retrieves all teams that the currently authenticated user belongs to, including their role in each team.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(TeamsListResponseSchema.describe('User teams retrieved successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(ErrorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const teams = await TeamService.getUserTeams(request.user.id);
      
      // Add role information to each team
      const teamsWithRoles = await Promise.all(
        teams.map(async (team) => {
          const membership = await TeamService.getTeamMembership(team.id, request.user!.id);
          return {
            ...team,
            role: membership?.role || 'team_user'
          };
        })
      );

      return reply.status(200).send({
        success: true,
        data: teamsWithRoles,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching user teams');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user teams',
      });
    }
  });
}
