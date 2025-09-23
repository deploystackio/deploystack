import { type FastifyInstance } from 'fastify';
import { SatelliteTokenService } from '../../../services/satelliteTokenService';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { 
  GENERATE_TEAM_TOKEN_SCHEMA, 
  TEAM_TOKEN_SUCCESS_RESPONSE_SCHEMA, 
  ERROR_RESPONSE_SCHEMA,
  type GenerateTokenRequest,
  type TeamRouteParams,
  type TeamTokenSuccessResponse,
  type ErrorResponse 
} from './schemas';

export default async function generateTeamToken(server: FastifyInstance) {
  server.post('/teams/:teamId/satellites/registration-tokens', {
    preValidation: [requireTeamPermission('satellites.manage')],
    schema: {
      tags: ['Satellite Registration'],
      summary: 'Generate team satellite registration token',
      description: 'Generates a time-limited JWT token for registering team-scoped satellites. Team administrators can create tokens for their teams. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1, description: 'Team ID' }
        },
        required: ['teamId'],
        additionalProperties: false
      },
      
      body: GENERATE_TEAM_TOKEN_SCHEMA,
      
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: GENERATE_TEAM_TOKEN_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...TEAM_TOKEN_SUCCESS_RESPONSE_SCHEMA,
          description: 'Team token generated successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Team admin required'
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
      const { expires_in_hours } = (request.body as GenerateTokenRequest) || {};
      const userId = request.user!.id;

      const { token, tokenRecord } = await SatelliteTokenService.generateRegistrationToken(
        'team',
        userId,
        teamId,
        expires_in_hours
      );

      // Audit log
      request.log.info({
        action: 'generate_team_satellite_token',
        user_id: userId,
        team_id: teamId,
        token_id: tokenRecord.id,
        expires_at: tokenRecord.expires_at,
        expires_in_hours: expires_in_hours || 24
      }, 'Team satellite registration token generated');

      const successResponse: TeamTokenSuccessResponse = {
        success: true,
        data: {
          token: {
            id: tokenRecord.id,
            token,
            token_type: 'team',
            team_id: teamId,
            created_by: userId,
            expires_at: tokenRecord.expires_at,
            created_at: tokenRecord.created_at,
            used: false
          }
        },
        instructions: `Use this token to register team satellites within ${expires_in_hours || 24} hour(s). Set environment variable: DEPLOYSTACK_REGISTRATION_TOKEN=${token}`
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error(error, 'Failed to generate team satellite token');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to generate registration token'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
