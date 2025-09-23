import { type FastifyInstance } from 'fastify';
import { SatelliteTokenService } from '../../../services/satelliteTokenService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { 
  GENERATE_GLOBAL_TOKEN_SCHEMA, 
  GLOBAL_TOKEN_SUCCESS_RESPONSE_SCHEMA, 
  ERROR_RESPONSE_SCHEMA,
  type GenerateTokenRequest,
  type GlobalTokenSuccessResponse,
  type ErrorResponse 
} from './schemas';

export default async function generateGlobalToken(server: FastifyInstance) {
  server.post('/satellites/global/registration-tokens', {
    preValidation: [requireGlobalAdmin()],
    schema: {
      tags: ['Satellite Registration'],
      summary: 'Generate global satellite registration token',
      description: 'Generates a time-limited JWT token for registering global satellites. Only global administrators can create these tokens. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      body: GENERATE_GLOBAL_TOKEN_SCHEMA,
      
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: GENERATE_GLOBAL_TOKEN_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...GLOBAL_TOKEN_SUCCESS_RESPONSE_SCHEMA,
          description: 'Token generated successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Global admin required'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { expires_in_hours } = (request.body as GenerateTokenRequest) || {};
      const userId = request.user!.id;

      const { token, tokenRecord } = await SatelliteTokenService.generateRegistrationToken(
        'global',
        userId,
        undefined,
        expires_in_hours
      );

      // Audit log
      request.log.info({
        action: 'generate_global_satellite_token',
        user_id: userId,
        token_id: tokenRecord.id,
        expires_at: tokenRecord.expires_at,
        expires_in_hours: expires_in_hours || 1
      }, 'Global satellite registration token generated');

      const successResponse: GlobalTokenSuccessResponse = {
        success: true,
        data: {
          token: {
            id: tokenRecord.id,
            token,
            token_type: 'global',
            team_id: null,
            created_by: userId,
            expires_at: tokenRecord.expires_at,
            created_at: tokenRecord.created_at,
            used: false
          }
        },
        instructions: `Use this token to register global satellites within ${expires_in_hours || 1} hour(s). Set environment variable: DEPLOYSTACK_REGISTRATION_TOKEN=${token}`
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error(error, 'Failed to generate global satellite token');
      const errorResponse: ErrorResponse = {
        success: false, 
        error: 'Failed to generate registration token'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
