import type { FastifyInstance } from 'fastify';
import { TeamService } from '../../services/teamService';
import { requirePermission } from '../../middleware/roleMiddleware';
import {
  CREATE_TEAM_REQUEST_SCHEMA,
  TEAM_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type CreateTeamRequest,
  type TeamSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function createTeamRoute(server: FastifyInstance) {
  // POST /teams - Create a new team
  server.post('/teams', {
    preValidation: requirePermission('teams.create'),
    schema: {
      tags: ['Teams'],
      summary: 'Create new team',
      description: 'Creates a new team with the specified name and description. Users can create up to 3 teams maximum. The slug is automatically generated from the team name and made unique. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      body: CREATE_TEAM_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: CREATE_TEAM_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        201: {
          ...TEAM_SUCCESS_RESPONSE_SCHEMA,
          description: 'Team created successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Validation error or team limit reached'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    },
  }, async (request, reply) => {
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
      const { name, description } = request.body as CreateTeamRequest;

      // Check if user can create more teams (3 team limit)
      const canCreate = await TeamService.canUserCreateTeam(request.user.id);
      if (!canCreate) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'You have reached the maximum limit of 3 teams'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Create the team
      const team = await TeamService.createTeam({
        name,
        description,
        owner_id: request.user.id,
      });

      const successResponse: TeamSuccessResponse = {
        success: true,
        data: team,
        message: 'Team created successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(201).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific team creation errors
        if (error.message.includes('slug')) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Team name conflicts with existing team'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      server.log.error(error, 'Error creating team');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to create team'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
