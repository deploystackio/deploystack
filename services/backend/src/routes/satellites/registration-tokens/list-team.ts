import { type FastifyInstance } from 'fastify';
import { SatelliteTokenService } from '../../../services/satelliteTokenService';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import type { TokenListResponse } from '../../../types/satellite';
import { 
  TOKEN_LIST_RESPONSE_SCHEMA, 
  ERROR_RESPONSE_SCHEMA, 
  type TeamRouteParams,
  type ErrorResponse 
} from './schemas';

export default async function listTeamTokens(server: FastifyInstance) {
  server.get('/teams/:teamId/satellites/registration-tokens', {
    preValidation: [requireTeamPermission('satellites.view')],
    schema: {
      tags: ['Satellite Registration'],
      summary: 'List team registration tokens',
      description: 'Lists all active registration tokens for a specific team. Team administrators can view tokens for their teams.',
      security: [{ cookieAuth: [] }],
      
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1, description: 'Team ID' }
        },
        required: ['teamId'],
        additionalProperties: false
      },
      
      response: {
        200: {
          ...TOKEN_LIST_RESPONSE_SCHEMA,
          description: 'List of team registration tokens'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { teamId } = request.params as TeamRouteParams;
      const tokens = await SatelliteTokenService.getActiveTokens('team', teamId);
      const response: TokenListResponse = { tokens };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error(error, 'Failed to list team registration tokens');
      const errorResponse: ErrorResponse = { 
        success: false, 
        error: 'Failed to list tokens' 
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
