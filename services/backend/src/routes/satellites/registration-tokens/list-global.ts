import { type FastifyInstance } from 'fastify';
import { SatelliteTokenService } from '../../../services/satelliteTokenService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import type { TokenListResponse } from '../../../types/satellite';
import { TOKEN_LIST_RESPONSE_SCHEMA, ERROR_RESPONSE_SCHEMA, type ErrorResponse } from './schemas';

export default async function listGlobalTokens(server: FastifyInstance) {
  server.get('/satellites/global/registration-tokens', {
    preValidation: [requireGlobalAdmin()],
    schema: {
      tags: ['Satellite Registration'],
      summary: 'List global registration tokens',
      description: 'Lists all active global satellite registration tokens. Only global administrators can view these tokens.',
      security: [{ cookieAuth: [] }],
      
      response: {
        200: {
          ...TOKEN_LIST_RESPONSE_SCHEMA,
          description: 'List of global registration tokens'
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
      const tokens = await SatelliteTokenService.getActiveTokens('global');
      const response: TokenListResponse = { tokens };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error(error, 'Failed to list global registration tokens');
      const errorResponse: ErrorResponse = { 
        success: false, 
        error: 'Failed to list tokens' 
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
