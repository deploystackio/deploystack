import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TeamService } from '../../../services/teamService';
import { checkUserPermission } from '../../../middleware/roleMiddleware';
import {
  TRANSFER_OWNERSHIP_SCHEMA,
  SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  TEAM_ID_PARAMS_SCHEMA,
  type TransferOwnershipInput,
  type SuccessResponse,
  type ErrorResponse
} from '../schemas';

export default async function transferOwnershipRoute(server: FastifyInstance) {
  server.put('/teams/:id/ownership', {
    // ✅ SECURITY FIRST: No authorization middleware needed as this has manual permission checks
    // This endpoint has complex authorization logic that needs to check team ownership
    schema: {
      tags: ['Team Members'],
      summary: 'Transfer team ownership',
      description: 'Transfers ownership of a team to another team member. Only current team owner can transfer ownership. Cannot transfer ownership of default teams. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Parameter validation
      params: TEAM_ID_PARAMS_SCHEMA,
      
      // Request body validation
      body: TRANSFER_OWNERSHIP_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: TRANSFER_OWNERSHIP_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Team ownership transferred successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Validation error, cannot transfer default team ownership, or new owner not a member'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Team not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: TransferOwnershipInput }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      // TypeScript type assertion (Fastify has already validated)
      const teamId = request.params.id;
      const { newOwnerId } = request.body as TransferOwnershipInput;

      // Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        const errorResponse: ErrorResponse = {
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
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Only the current team owner can transfer ownership'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Transfer ownership
      await TeamService.transferOwnership(teamId, newOwnerId);

      const successResponse: SuccessResponse = {
        success: true,
        message: 'Team ownership transferred successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof Error) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: error.message
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      server.log.error(error, 'Error transferring team ownership');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to transfer team ownership'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
