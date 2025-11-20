import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireSatelliteAuth } from '../../middleware/satelliteAuthMiddleware';
import { getDb } from '../../db';
import { OAuthTokenRetrievalService } from '../../services/OAuthTokenRetrievalService';
import { isTokenExpired } from '../../utils/oauth-token-utils';
import {
  RETRIEVE_TOKENS_REQUEST_SCHEMA,
  RETRIEVE_TOKENS_SUCCESS_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type RetrieveTokensRequest,
  type RetrieveTokensSuccess,
  type ErrorResponse
} from './tokens-schemas';

/**
 * Satellite OAuth Token Retrieval Endpoint
 *
 * This endpoint allows satellites to retrieve decrypted OAuth tokens when spawning MCP servers.
 * CRITICAL: Only satellites can access this endpoint (authenticated via API keys).
 *
 * Security features:
 * - Satellite authentication required (requireSatelliteAuth middleware)
 * - Team isolation (team satellites can only access their team's tokens)
 * - Rate limiting (100 requests/minute per satellite)
 * - Audit logging for all token retrievals
 * - Token expiration warnings
 */
export default async function satelliteTokensRoute(server: FastifyInstance) {
  server.post('/satellites/:satelliteId/tokens/retrieve', {
    preValidation: [requireSatelliteAuth()],

    config: {
      rateLimit: {
        max: 100,
        timeWindow: '1 minute',
        keyGenerator: (request) => {
          // Identify by satellite ID from auth middleware
          return request.satellite?.id || request.ip;
        }
      }
    },

    schema: {
      tags: ['Satellite OAuth'],
      summary: 'Retrieve decrypted OAuth tokens for MCP server spawning',
      description: 'Returns decrypted OAuth access and refresh tokens for a specific MCP server installation. Only accessible by authenticated satellites. Rate limited to 100 requests per minute per satellite.',
      security: [{ bearerAuth: [] }], // Satellite API key authentication

      params: {
        type: 'object',
        properties: {
          satelliteId: {
            type: 'string',
            description: 'Satellite ID (must match authenticated satellite)'
          }
        },
        required: ['satelliteId']
      },

      body: RETRIEVE_TOKENS_REQUEST_SCHEMA,

      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: RETRIEVE_TOKENS_REQUEST_SCHEMA
          }
        }
      },

      response: {
        200: {
          ...RETRIEVE_TOKENS_SUCCESS_SCHEMA,
          description: 'OAuth tokens retrieved successfully'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Satellite does not have access to this team'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - No OAuth tokens found for this installation'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error - Failed to retrieve or decrypt tokens'
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { installation_id, user_id, team_id } = request.body as RetrieveTokensRequest;
    const { satelliteId } = request.params as { satelliteId: string };

    // Type guard: requireSatelliteAuth middleware ensures satellite exists
    if (!request.satellite) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Satellite authentication required'
      };
      return reply.status(403).type('application/json').send(JSON.stringify(errorResponse));
    }

    // Verify satellite ID matches authenticated satellite
    if (request.satellite.id !== satelliteId) {
      request.log.warn({
        authenticated_satellite_id: request.satellite.id,
        requested_satellite_id: satelliteId
      }, 'Satellite ID mismatch in request');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Satellite ID mismatch - authentication required for this satellite'
      };
      return reply.status(403).type('application/json').send(JSON.stringify(errorResponse));
    }

    // Team access validation: Team satellites can only access their team's tokens
    if (request.satellite.satellite_type === 'team' &&
        request.satellite.team_id !== team_id) {

      request.log.warn({
        satellite_id: request.satellite.id,
        satellite_team_id: request.satellite.team_id,
        requested_team_id: team_id
      }, 'Satellite attempted to access tokens for different team');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Satellite does not have access to this team'
      };
      return reply.status(403).type('application/json').send(JSON.stringify(errorResponse));
    }

    // Retrieve and decrypt tokens
    const db = getDb();
    const retrievalService = new OAuthTokenRetrievalService(db, request.log);

    try {
      const tokens = await retrievalService.getDecryptedTokens(
        installation_id,
        user_id,
        team_id
      );

      if (!tokens) {
        request.log.debug({
          installation_id,
          user_id,
          team_id
        }, 'No OAuth tokens found for installation');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'OAuth tokens not found for this installation - user needs to authorize'
        };
        return reply.status(404).type('application/json').send(JSON.stringify(errorResponse));
      }

      // Check token expiration and warn (but still return the token)
      if (tokens.expires_at && isTokenExpired(tokens.expires_at)) {
        request.log.warn({
          installation_id,
          user_id,
          team_id,
          expires_at: tokens.expires_at
        }, 'OAuth token is expired - satellite may receive 401 from MCP server');
      }

      // Audit logging for token retrieval
      request.log.info({
        operation: 'oauth_token_retrieval',
        satellite_id: request.satellite.id,
        satellite_type: request.satellite.satellite_type,
        installation_id,
        user_id,
        team_id,
        expires_at: tokens.expires_at?.toISOString() || null
      }, 'OAuth tokens retrieved for satellite');

      // Prepare success response
      const successResponse: RetrieveTokensSuccess = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expires_at: tokens.expires_at?.toISOString() || null,
        scope: tokens.scope
      };

      return reply.status(200).type('application/json').send(JSON.stringify(successResponse));

    } catch (error) {
      request.log.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        installation_id,
        user_id,
        team_id
      }, 'Failed to retrieve OAuth tokens');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to retrieve OAuth tokens'
      };
      return reply.status(500).type('application/json').send(JSON.stringify(errorResponse));
    }
  });
}
