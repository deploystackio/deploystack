import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TeamService } from '../../services/teamService';
import { requirePermission, checkUserPermission } from '../../middleware/roleMiddleware';
import {
  CreateTeamSchema,
  UpdateTeamSchema,
  TeamResponseSchema,
  TeamsListResponseSchema,
  TeamsListWithRoleInfoResponseSchema,
  TeamMembersListResponseSchema,
  TeamMemberResponseSchema,
  AddTeamMemberSchema,
  UpdateMemberRoleSchema,
  TransferOwnershipSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  type CreateTeamInput,
  type UpdateTeamInput,
  type AddTeamMemberInput,
  type UpdateMemberRoleInput,
  type TransferOwnershipInput,
} from './schemas';

export default async function teamsRoute(fastify: FastifyInstance) {
  // GET /teams/me/default - Get current user's default team (must come before /me route)
  fastify.get('/teams/me/default', {
    schema: {
      tags: ['Teams'],
      summary: 'Get current user default team',
      description: 'Retrieves the default team for the currently authenticated user.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(TeamResponseSchema.describe('Default team retrieved successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(ErrorResponseSchema.describe('Not Found - No default team found'), {
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

      const defaultTeam = await TeamService.getUserDefaultTeam(request.user.id);
      
      if (!defaultTeam) {
        return reply.status(404).send({
          success: false,
          error: 'No default team found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: defaultTeam,
        message: 'Default team retrieved successfully',
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching user default team');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch default team',
      });
    }
  });

  // GET /teams/me - Get current user's teams (must come before /:id route)
  fastify.get('/teams/me', {
    schema: {
      tags: ['Teams'],
      summary: 'Get current user teams',
      description: 'Retrieves all teams that the currently authenticated user belongs to, including their role, admin status, ownership status, and member count.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(TeamsListWithRoleInfoResponseSchema.describe('User teams retrieved successfully'), {
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

      const teamsWithRoles = await TeamService.getUserTeamsWithRoles(request.user.id);

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

  // GET /teams/:id - Get team by ID
  fastify.get<{ Params: { id: string } }>('/teams/:id', {
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

  // POST /teams - Create a new team
  fastify.post<{ Body: CreateTeamInput }>('/teams', {
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

  // ===== TEAM MEMBER MANAGEMENT ENDPOINTS =====

  // GET /teams/:id/members - Get team members
  fastify.get<{ Params: { id: string } }>('/teams/:id/members', {
    schema: {
      tags: ['Teams'],
      summary: 'Get team members',
      description: 'Retrieves all members of a specific team with their user information, roles, and status flags.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: zodToJsonSchema(TeamMembersListResponseSchema.describe('Team members retrieved successfully'), {
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

      // Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        return reply.status(404).send({
          success: false,
          error: 'Team not found',
        });
      }

      // Check if user has access to view team members
      const isTeamMember = await TeamService.isTeamMember(teamId, request.user.id);
      const hasGlobalPermission = await checkUserPermission(request.user.id, 'team.members.view');
      
      if (!isTeamMember && !hasGlobalPermission) {
        return reply.status(403).send({
          success: false,
          error: 'You do not have permission to view this team\'s members',
        });
      }

      const members = await TeamService.getTeamMembersWithUserInfo(teamId);

      return reply.status(200).send({
        success: true,
        data: members,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching team members');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch team members',
      });
    }
  });

  // POST /teams/:id/members - Add team member
  fastify.post<{ Params: { id: string }; Body: AddTeamMemberInput }>('/teams/:id/members', {
    schema: {
      tags: ['Teams'],
      summary: 'Add team member',
      description: 'Adds a new member to a team. Only team admins and owners can add members. Cannot add members to default teams. Teams are limited to 3 members maximum.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: zodToJsonSchema(AddTeamMemberSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        201: zodToJsonSchema(TeamMemberResponseSchema.describe('Team member added successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(ErrorResponseSchema.describe('Bad Request - Validation error, team limit reached, or cannot add to default team'), {
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
        404: zodToJsonSchema(ErrorResponseSchema.describe('Not Found - Team or user not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(ErrorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: AddTeamMemberInput }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const teamId = request.params.id;
      const validatedData = AddTeamMemberSchema.parse(request.body);

      // Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        return reply.status(404).send({
          success: false,
          error: 'Team not found',
        });
      }

      // Default teams are protected - NO ONE can add members to them (including global admins)
      if (team.is_default) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot add members to default teams',
        });
      }

      // Check permissions
      const hasGlobalPermission = await checkUserPermission(request.user.id, 'team.members.manage');
      const canManage = hasGlobalPermission || 
        await TeamService.canUserManageTeamMember(teamId, request.user.id, validatedData.userId, 'add');

      if (!canManage) {
        return reply.status(403).send({
          success: false,
          error: 'You do not have permission to add members to this team',
        });
      }

      // Add the member
      const membership = await TeamService.addTeamMember(teamId, validatedData.userId, validatedData.role);

      // Get the full member info to return
      const members = await TeamService.getTeamMembersWithUserInfo(teamId);
      const newMember = members.find(m => m.user_id === validatedData.userId);

      return reply.status(201).send({
        success: true,
        data: newMember,
        message: 'Team member added successfully',
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
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      fastify.log.error(error, 'Error adding team member');
      return reply.status(500).send({
        success: false,
        error: 'Failed to add team member',
      });
    }
  });

  // PUT /teams/:id/members/:userId/role - Update member role
  fastify.put<{ Params: { id: string; userId: string }; Body: UpdateMemberRoleInput }>('/teams/:id/members/:userId/role', {
    schema: {
      tags: ['Teams'],
      summary: 'Update team member role',
      description: 'Updates a team member\'s role. Only team owners can change roles. Cannot change roles in default teams. Must maintain at least one team admin.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' }
        },
        required: ['id', 'userId']
      },
      body: zodToJsonSchema(UpdateMemberRoleSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(TeamMemberResponseSchema.describe('Team member role updated successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(ErrorResponseSchema.describe('Bad Request - Validation error, cannot change roles in default team, or would leave no admins'), {
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
        404: zodToJsonSchema(ErrorResponseSchema.describe('Not Found - Team or user not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(ErrorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string; userId: string }; Body: UpdateMemberRoleInput }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const teamId = request.params.id;
      const targetUserId = request.params.userId;
      const validatedData = UpdateMemberRoleSchema.parse(request.body);

      // Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        return reply.status(404).send({
          success: false,
          error: 'Team not found',
        });
      }

      // Check permissions
      const hasGlobalPermission = await checkUserPermission(request.user.id, 'team.members.manage');
      const canManage = hasGlobalPermission || 
        await TeamService.canUserManageTeamMember(teamId, request.user.id, targetUserId, 'change_role');

      if (!canManage) {
        return reply.status(403).send({
          success: false,
          error: 'You do not have permission to change this member\'s role',
        });
      }

      // Update the role
      await TeamService.updateMemberRole(teamId, targetUserId, validatedData.role);

      // Get the updated member info to return
      const members = await TeamService.getTeamMembersWithUserInfo(teamId);
      const updatedMember = members.find(m => m.user_id === targetUserId);

      return reply.status(200).send({
        success: true,
        data: updatedMember,
        message: 'Team member role updated successfully',
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
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      fastify.log.error(error, 'Error updating team member role');
      return reply.status(500).send({
        success: false,
        error: 'Failed to update team member role',
      });
    }
  });

  // DELETE /teams/:id/members/:userId - Remove team member
  fastify.delete<{ Params: { id: string; userId: string } }>('/teams/:id/members/:userId', {
    schema: {
      tags: ['Teams'],
      summary: 'Remove team member',
      description: 'Removes a member from a team. Only team owners can remove members. Cannot remove members from default teams. Cannot remove team owner.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' }
        },
        required: ['id', 'userId']
      },
      response: {
        200: zodToJsonSchema(SuccessResponseSchema.describe('Team member removed successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(ErrorResponseSchema.describe('Bad Request - Cannot remove from default team, cannot remove owner, or would leave team empty'), {
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
        404: zodToJsonSchema(ErrorResponseSchema.describe('Not Found - Team or user not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(ErrorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string; userId: string } }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const teamId = request.params.id;
      const targetUserId = request.params.userId;

      // Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        return reply.status(404).send({
          success: false,
          error: 'Team not found',
        });
      }

      // Check permissions
      const hasGlobalPermission = await checkUserPermission(request.user.id, 'team.members.manage');
      const canManage = hasGlobalPermission || 
        await TeamService.canUserManageTeamMember(teamId, request.user.id, targetUserId, 'remove');

      if (!canManage) {
        return reply.status(403).send({
          success: false,
          error: 'You do not have permission to remove this member',
        });
      }

      // Remove the member
      await TeamService.removeTeamMember(teamId, targetUserId);

      return reply.status(200).send({
        success: true,
        message: 'Team member removed successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      fastify.log.error(error, 'Error removing team member');
      return reply.status(500).send({
        success: false,
        error: 'Failed to remove team member',
      });
    }
  });

  // PUT /teams/:id/ownership - Transfer team ownership
  fastify.put<{ Params: { id: string }; Body: TransferOwnershipInput }>('/teams/:id/ownership', {
    schema: {
      tags: ['Teams'],
      summary: 'Transfer team ownership',
      description: 'Transfers ownership of a team to another team member. Only current team owner can transfer ownership. Cannot transfer ownership of default teams.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: zodToJsonSchema(TransferOwnershipSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(SuccessResponseSchema.describe('Team ownership transferred successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(ErrorResponseSchema.describe('Bad Request - Validation error, cannot transfer default team ownership, or new owner not a member'), {
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
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: TransferOwnershipInput }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const teamId = request.params.id;
      const validatedData = TransferOwnershipSchema.parse(request.body);

      // Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        return reply.status(404).send({
          success: false,
          error: 'Team not found',
        });
      }

      // Check permissions - only current owner or global admin can transfer ownership
      const hasGlobalPermission = await checkUserPermission(request.user.id, 'team.members.manage');
      const isCurrentOwner = team.owner_id === request.user.id;

      if (!isCurrentOwner && !hasGlobalPermission) {
        return reply.status(403).send({
          success: false,
          error: 'Only the current team owner can transfer ownership',
        });
      }

      // Transfer ownership
      await TeamService.transferOwnership(teamId, validatedData.newOwnerId);

      return reply.status(200).send({
        success: true,
        message: 'Team ownership transferred successfully',
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
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      fastify.log.error(error, 'Error transferring team ownership');
      return reply.status(500).send({
        success: false,
        error: 'Failed to transfer team ownership',
      });
    }
  });
}
