import { type FastifyInstance } from 'fastify';
import { SatelliteTokenService } from '../../../services/satelliteTokenService';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { RoleService } from '../../../services/roleService';
import { ERROR_RESPONSE_SCHEMA, type ErrorResponse } from './schemas';

export default async function listAllTokens(server: FastifyInstance) {
  server.get('/satellites/registration-tokens', {
    preValidation: [requirePermission('satellites.view')],
    schema: {
      tags: ['Satellite Registration'],
      summary: 'List all registration tokens',
      description: 'Lists all registration tokens. Only global administrators can access this endpoint.',
      security: [{ cookieAuth: [] }],
      
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
        },
        additionalProperties: false
      },
      
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', default: true },
            data: {
              type: 'object',
              properties: {
                tokens: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      token: { type: 'string' },
                      token_type: { type: 'string', enum: ['global', 'team'] },
                      team_id: { type: 'string', nullable: true },
                      team_slug: { type: 'string', nullable: true },
                      created_by: { type: 'string' },
                      creator_name: { type: 'string', nullable: true },
                      expires_at: { type: 'string', format: 'date-time' },
                      created_at: { type: 'string', format: 'date-time' },
                      used: { type: 'boolean' },
                      used_at: { type: 'string', format: 'date-time', nullable: true },
                      used_by: { type: 'string', nullable: true }
                    },
                    required: ['id', 'token', 'token_type', 'team_id', 'created_by', 'expires_at', 'created_at', 'used']
                  }
                },
                pagination: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    page: { type: 'number' },
                    pages: { type: 'number' },
                    limit: { type: 'number' }
                  },
                  required: ['total', 'page', 'pages', 'limit']
                }
              },
              required: ['tokens']
            }
          },
          required: ['success', 'data'],
          description: 'List of all registration tokens user has access to'
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
      const { page = 1, limit = 50 } = request.query as { page?: number; limit?: number };
      const userId = request.user!.id;
      
      // Get user's role to determine access level
      const roleService = new RoleService();
      const userRole = await roleService.getUserRole(userId);
      const userRoleId = userRole?.id || 'user';
      
      // Get all tokens user has access to
      const tokens = await SatelliteTokenService.getAllTokensForUser(userId, userRoleId, page, limit);
      
      const successResponse = {
        success: true,
        data: {
          tokens: tokens.data,
          pagination: tokens.pagination
        }
      };
      
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error(error, 'Failed to list registration tokens');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to list registration tokens'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
