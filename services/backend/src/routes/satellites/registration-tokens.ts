/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyInstance } from 'fastify';
import { SatelliteTokenService } from '../../services/satelliteTokenService';
import { requireGlobalAdmin, requireTeamPermission, requireAuthentication } from '../../middleware/roleMiddleware';
import type { 
  TokenGenerationRequest, 
  TokenGenerationResponse, 
  TokenListResponse,
  TokenRevokeResponse 
} from '../../types/satellite';

// Request and Response Schemas
const GENERATE_GLOBAL_TOKEN_SCHEMA = {
  type: 'object',
  properties: {
    expires_in_hours: { 
      type: 'number', 
      minimum: 1, 
      maximum: 24,
      description: 'Token expiration in hours (max 24 hours for security)'
    }
  },
  additionalProperties: false
} as const;

const GENERATE_TEAM_TOKEN_SCHEMA = {
  type: 'object',
  properties: {
    expires_in_hours: { 
      type: 'number', 
      minimum: 1, 
      maximum: 72,
      description: 'Token expiration in hours (max 72 hours for team tokens)'
    }
  },
  additionalProperties: false
} as const;

const GLOBAL_TOKEN_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    token: { type: 'string', description: 'Complete token with prefix (deploystack_satellite_global_...)' },
    expires_at: { type: 'string', format: 'date-time', description: 'ISO timestamp when token expires' },
    scope: { type: 'string', enum: ['global'], description: 'Token scope' },
    instructions: { type: 'string', description: 'Instructions for using the token' }
  },
  required: ['success', 'token', 'expires_at', 'scope', 'instructions']
} as const;

const TEAM_TOKEN_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    token: { type: 'string', description: 'Complete token with prefix (deploystack_satellite_team_...)' },
    expires_at: { type: 'string', format: 'date-time', description: 'ISO timestamp when token expires' },
    scope: { type: 'string', enum: ['team'], description: 'Token scope' },
    team_id: { type: 'string', description: 'Team ID this token is scoped to' },
    instructions: { type: 'string', description: 'Instructions for using the token' }
  },
  required: ['success', 'token', 'expires_at', 'scope', 'team_id', 'instructions']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

const TOKEN_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    tokens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          token_type: { type: 'string', enum: ['global', 'team'] },
          team_id: { type: 'string', nullable: true },
          created_by: { type: 'string' },
          expires_at: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
          used: { type: 'boolean' }
        },
        required: ['id', 'token_type', 'team_id', 'created_by', 'expires_at', 'created_at', 'used']
      }
    }
  },
  required: ['tokens']
} as const;

// TypeScript interfaces
interface GenerateTokenRequest {
  expires_in_hours?: number;
}

interface TeamRouteParams {
  teamId: string;
}

interface TokenRouteParams {
  tokenId: string;
}

interface GlobalTokenSuccessResponse {
  success: boolean;
  token: string;
  expires_at: string;
  scope: 'global';
  instructions: string;
}

interface TeamTokenSuccessResponse {
  success: boolean;
  token: string;
  expires_at: string;
  scope: 'team';
  team_id: string;
  instructions: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function registrationTokenRoutes(server: FastifyInstance) {
  
  /**
   * Generate Global Satellite Registration Token
   * Only global_admin can generate global tokens
   */
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
        token,
        expires_at: tokenRecord.expires_at,
        scope: 'global',
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
      return reply.status(500 as any).type('application/json').send(jsonString);
    }
  });

  /**
   * Generate Team Satellite Registration Token  
   * team_admin can generate tokens for their teams
   */
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
        token,
        expires_at: tokenRecord.expires_at,
        scope: 'team',
        team_id: teamId,
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
      return reply.status(500 as any).type('application/json').send(jsonString);
    }
  });

  /**
   * List Active Global Registration Tokens
   */
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
      return reply.status(500 as any).type('application/json').send(jsonString);
    }
  });

  /**
   * List Active Team Registration Tokens
   */
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
      return reply.status(500 as any).type('application/json').send(jsonString);
    }
  });

  /**
   * Revoke Registration Token
   */
  server.delete('/satellites/registration-tokens/:tokenId', {
    preValidation: [requireAuthentication()],
    schema: {
      tags: ['Satellite Registration'],
      summary: 'Revoke registration token',
      description: 'Revokes an unused registration token. Users can revoke tokens they created. Global admins can revoke any token.',
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

      // TODO: Add authorization check to ensure user can revoke this token
      // For now, allow any authenticated user to attempt revocation
      
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
      return reply.status(500 as any).type('application/json').send(jsonString);
    }
  });
}
