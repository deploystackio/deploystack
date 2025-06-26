import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TeamService } from '../../services/teamService';
import { requirePermission } from '../../middleware/roleMiddleware';
import {
  CreateTeamSchema,
  UpdateTeamSchema,
  TeamResponseSchema,
  TeamsListResponseSchema,
  ErrorResponseSchema,
  type CreateTeamInput,
  type UpdateTeamInput,
} from './schemas';

export default async function teamsRoute(fastify: FastifyInstance) {
  // GET /api/teams/me - Get current user's teams (must come before /:id route)
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

  // GET /api/teams/:id - Get team by ID
  fastify.get<{ Params: { id: string } }>('/api/teams/:id', {
    schema: {
      tags: ['Teams'],
      summary: 'Get team by ID',
      description: 'Retrieves a specific team by its ID. User must be a member of the team.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: zodToJsonSchema(TeamResponseSchema.describe('Team retrieved successfully'), {
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
        404: zodToJsonSchema(ErrorResponseSchema.describe('Not Found - Team not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(ErrorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const teamId = request.params.id;
      const team = await TeamService.getTeamById(teamId);

      if (!team) {
        return reply.status(404).send({
          success: false,
          error: 'Team not found',
        });
      }

      // Check if user has access to this team
      const isTeamMember = await TeamService.isTeamMember(teamId, request.user.id);
      
      if (!isTeamMember) {
        return reply.status(403).send({
          success: false,
          error: 'You do not have access to this team',
        });
      }

      return reply.status(200).send({
        success: true,
        data: team,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching team');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch team',
      });
    }
  });

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

  // PUT /api/teams/:id - Update team
  fastify.put<{ Params: { id: string }; Body: UpdateTeamInput }>('/api/teams/:id', {
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
      body: zodToJsonSchema(UpdateTeamSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(TeamResponseSchema.describe('Team updated successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(ErrorResponseSchema.describe('Bad Request - Validation error or cannot update default team name'), {
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
        404: zodToJsonSchema(ErrorResponseSchema.describe('Not Found - Team not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(ErrorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('teams.edit'),
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
      const isDefaultTeam = await TeamService.isDefaultTeam(teamId, request.user.id);
      if (isDefaultTeam && validatedData.name && validatedData.name !== existingTeam.name) {
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
          details: error.errors,
        });
      }

      fastify.log.error(error, 'Error updating team');
      return reply.status(500).send({
        success: false,
        error: 'Failed to update team',
      });
    }
  });

  // DELETE /api/teams/:id - Delete team
  fastify.delete<{ Params: { id: string } }>('/api/teams/:id', {
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
        400: zodToJsonSchema(ErrorResponseSchema.describe('Bad Request - Cannot delete default team or team has active resources'), {
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
        404: zodToJsonSchema(ErrorResponseSchema.describe('Not Found - Team not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(ErrorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('teams.delete'),
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

      // Check if it's a default team with better error handling
      let isDefaultTeam = false;
      try {
        isDefaultTeam = await TeamService.isDefaultTeam(teamId, request.user.id);
        fastify.log.info(`Default team check for team ${teamId}: ${isDefaultTeam}`);
      } catch (defaultTeamError) {
        fastify.log.error(defaultTeamError, 'Error checking if team is default team');
        return reply.status(500).send({
          success: false,
          error: 'Failed to verify team deletion eligibility',
        });
      }

      if (isDefaultTeam) {
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
