import { type FastifyInstance } from 'fastify';
import { SatelliteTokenService } from '../../../services/satelliteTokenService';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { ERROR_RESPONSE_SCHEMA, type TokenRouteParams, type ErrorResponse } from './schemas';

export default async function revokeToken(server: FastifyInstance) {
  server.delete('/satellites/registration-tokens/:tokenId', {
    preValidation: [requirePermission('satellites.revoke')],
    schema: {
      tags: ['Satellite Registration'],
      summary: 'Revoke registration token',
      description: 'Revokes an unused registration token. Only global administrators can revoke satellite registration tokens.',
      security: [{ cookieAuth: [] }],
      
      params: {
        type: 'object',
        properties: {
          tokenId: { type: 'string', minLength: 1, description: 'Token ID to revoke' }
        },
        required: ['tokenId'],
        additionalProperties: false
      },
      
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          },
          required: ['success'],
          description: 'Token revoked successfully'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Token not found or already used'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
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
    }
  }, async (request, reply) => {
    try {
      const { tokenId } = request.params as TokenRouteParams;
      const userId = request.user!.id;
      
      const revoked = await SatelliteTokenService.revokeToken(tokenId);
      
      if (!revoked) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Token not found or already used'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Audit log
      request.log.info({
        action: 'revoke_satellite_token',
        user_id: userId,
        token_id: tokenId
      }, 'Satellite registration token revoked');

      const successResponse = { success: true };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error(error, 'Failed to revoke registration token');
      const errorResponse: ErrorResponse = { 
        success: false, 
        error: 'Failed to revoke token' 
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
