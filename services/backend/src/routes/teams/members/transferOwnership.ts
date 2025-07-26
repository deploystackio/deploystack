import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { createSchema } from 'zod-openapi';
import { TeamService } from '../../../services/teamService';
import { checkUserPermission } from '../../../middleware/roleMiddleware';
import {
  TransferOwnershipSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  type TransferOwnershipInput,
} from '../schemas';

export default async function transferOwnershipRoute(fastify: FastifyInstance) {
  // PUT /teams/:id/ownership - Transfer team ownership
  fastify.put<{ Params: { id: string }; Body: TransferOwnershipInput }>('/teams/:id/ownership', {
    schema: {
      tags: ['Team Members'],
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
      body: createSchema(TransferOwnershipSchema),
      response: {
        200: createSchema(SuccessResponseSchema.describe('Team ownership transferred successfully')),
        400: createSchema(ErrorResponseSchema.describe('Bad Request - Validation error, cannot transfer default team ownership, or new owner not a member')),
        401: createSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(ErrorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(ErrorResponseSchema.describe('Not Found - Team not found')),
        500: createSchema(ErrorResponseSchema.describe('Internal Server Error'))
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: TransferOwnershipInput }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        const errorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      const teamId = request.params.id;
      const validatedData = TransferOwnershipSchema.parse(request.body);

      // Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        const errorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Check permissions - only current owner or global admin can transfer ownership
      const hasGlobalPermission = await checkUserPermission(request.user.id, 'team.members.manage');
      const isCurrentOwner = team.owner_id === request.user.id;

      if (!isCurrentOwner && !hasGlobalPermission) {
        const errorResponse = {
          success: false,
          error: 'Only the current team owner can transfer ownership'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Transfer ownership
      await TeamService.transferOwnership(teamId, validatedData.newOwnerId);

      const successResponse = {
        success: true,
        message: 'Team ownership transferred successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorResponse = {
          success: false,
          error: 'Validation error',
          details: error.issues
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      if (error instanceof Error) {
        const errorResponse = {
          success: false,
          error: error.message
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      fastify.log.error(error, 'Error transferring team ownership');
      const errorResponse = {
        success: false,
        error: 'Failed to transfer team ownership'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
