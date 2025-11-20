import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireSatelliteAuth } from '../../middleware/satelliteAuthMiddleware';
import { getDb } from '../../db';
import { mcpOauthTokens } from '../../db/schema.sqlite';
import { and, eq } from 'drizzle-orm';
import { isTokenExpired } from '../../utils/oauth-token-utils';
import {
  TOKEN_STATUS_REQUEST_SCHEMA,
  TOKEN_STATUS_SUCCESS_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type TokenStatusRequest,
  type TokenStatusSuccess,
  type ErrorResponse
} from './tokens-schemas';

/**
 * Satellite OAuth Token Status Endpoint
 *
 * This endpoint allows satellites to check token status WITHOUT decryption.
 * Used to determine if tokens exist and whether they're expired before attempting retrieval.
 *
 * Security features:
 * - Satellite authentication required (requireSatelliteAuth middleware)
 * - Team isolation (team satellites can only check their team's tokens)
 * - No token decryption (lightweight operation)
 * - Audit logging for status checks
 */
export default async function satelliteTokensStatusRoute(server: FastifyInstance) {
  server.post('/satellites/:satelliteId/tokens/status', {
    preValidation: [requireSatelliteAuth()],

    schema: {
      tags: ['Satellite OAuth'],
      summary: 'Check OAuth token status without decryption',
      description: 'Returns token metadata (existence, expiration, refresh capability) without decrypting the tokens. Useful for satellites to check token status before attempting retrieval.',
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

      body: TOKEN_STATUS_REQUEST_SCHEMA,

      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: TOKEN_STATUS_REQUEST_SCHEMA
          }
        }
      },

      response: {
        200: {
          ...TOKEN_STATUS_SUCCESS_SCHEMA,
          description: 'Token status retrieved successfully'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Satellite does not have access to this team'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error - Failed to check token status'
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { installation_id, user_id, team_id } = request.body as TokenStatusRequest;
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
      }, 'Satellite ID mismatch in status check request');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Satellite ID mismatch - authentication required for this satellite'
      };
      return reply.status(403).type('application/json').send(JSON.stringify(errorResponse));
    }

    // Team access validation: Team satellites can only check their team's tokens
    if (request.satellite.satellite_type === 'team' &&
        request.satellite.team_id !== team_id) {

      request.log.warn({
        satellite_id: request.satellite.id,
        satellite_team_id: request.satellite.team_id,
        requested_team_id: team_id
      }, 'Satellite attempted to check token status for different team');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Satellite does not have access to this team'
      };
      return reply.status(403).type('application/json').send(JSON.stringify(errorResponse));
    }

    // Check token status without decryption
    const db = getDb();

    try {
      const [tokenRecord] = await db
        .select({
          id: mcpOauthTokens.id,
          expires_at: mcpOauthTokens.expires_at,
          has_refresh_token: mcpOauthTokens.refresh_token
        })
        .from(mcpOauthTokens)
        .where(
          and(
            eq(mcpOauthTokens.installation_id, installation_id),
            eq(mcpOauthTokens.user_id, user_id),
            eq(mcpOauthTokens.team_id, team_id)
          )
        )
        .limit(1);

      if (!tokenRecord) {
        // No tokens found - return exists: false
        const successResponse: TokenStatusSuccess = {
          exists: false,
          expired: null,
          expires_at: null,
          can_refresh: false
        };

        request.log.debug({
          installation_id,
          user_id,
          team_id
        }, 'Token status check: no tokens found');

        return reply.status(200).type('application/json').send(JSON.stringify(successResponse));
      }

      // Tokens exist - check expiration
      const expired = tokenRecord.expires_at
        ? isTokenExpired(tokenRecord.expires_at)
        : null; // null means no expiration (token doesn't expire)

      const successResponse: TokenStatusSuccess = {
        exists: true,
        expired,
        expires_at: tokenRecord.expires_at?.toISOString() || null,
        can_refresh: !!tokenRecord.has_refresh_token
      };

      request.log.debug({
        satellite_id: request.satellite.id,
        installation_id,
        user_id,
        team_id,
        exists: true,
        expired,
        can_refresh: !!tokenRecord.has_refresh_token
      }, 'Token status check completed');

      return reply.status(200).type('application/json').send(JSON.stringify(successResponse));

    } catch (error) {
      request.log.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        installation_id,
        user_id,
        team_id
      }, 'Failed to check OAuth token status');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to check OAuth token status'
      };
      return reply.status(500).type('application/json').send(JSON.stringify(errorResponse));
    }
  });
}
