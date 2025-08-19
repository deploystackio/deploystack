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
import { EVENT_NAMES } from '../../events';
import type { EventContext } from '../../events/types';

export default async function createTeamRoute(server: FastifyInstance) {
  // POST /teams - Create a new team
  server.post('/teams', {
    preValidation: requirePermission('teams.create'),
    schema: {
      tags: ['Teams'],
      summary: 'Create new team',
      description: 'Creates a new team with the specified name and description. Team creation limit is configurable via global settings (default: 3 teams maximum). The slug is automatically generated from the team name and made unique. Requires Content-Type: application/json header when sending request body.',
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

      // Check if user can create more teams (dynamic team limit)
      const canCreate = await TeamService.canUserCreateTeam(request.user.id);
      if (!canCreate) {
        // Get the current team limit for a proper error message
        const { GlobalSettings } = await import('../../global-settings/helpers');
        const teamLimit = await GlobalSettings.getNumber('global.team_creation_limit', 3);
        const errorResponse: ErrorResponse = {
          success: false,
          error: `You have reached the maximum limit of ${teamLimit} teams`
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

      // Emit TEAM_CREATED event
      try {
        const eventContext: EventContext = {
          db: server.db,
          logger: server.log,
          user: {
            id: request.user.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            email: (request.user as any).email,
            roleId: 'unknown' // We'd need to fetch this from DB if needed
          },
          request: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: request.id
          },
          timestamp: new Date()
        };

        server.eventBus.emitWithContext(
          EVENT_NAMES.TEAM_CREATED,
          {
            team: {
              id: team.id,
              name: team.name,
              description: team.description || undefined
            },
            createdBy: {
              id: request.user.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email
            },
            metadata: {
              ip: request.ip
            }
          },
          eventContext
        );
        server.log.info(`TEAM_CREATED event emitted for team: ${team.id}`);
      } catch (eventError) {
        server.log.error(eventError, `Failed to emit TEAM_CREATED event for team ${team.id}:`);
        // Don't fail team creation if event emission fails
      }

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
