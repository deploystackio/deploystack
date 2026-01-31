import type { FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../db';
import { satellites } from '../db/schema';
import { verify } from '@node-rs/argon2';

// Extend FastifyRequest to include satellite context
declare module 'fastify' {
  interface FastifyRequest {
    satellite?: {
      id: string;
      name: string;
      satellite_type: 'global' | 'team';
      team_id: string | null;
      status: 'active' | 'inactive' | 'maintenance' | 'error';
    };
  }
}

/**
 * Middleware to require valid satellite API key authentication
 */
export function requireSatelliteAuth() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const errorResponse = {
          success: false,
          error: 'Authentication required. Please provide a valid satellite API key via Bearer token.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

      if (!apiKey) {
        const errorResponse = {
          success: false,
          error: 'Invalid API key format. Please provide a valid satellite API key.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      const db = getDb();

      // Get all satellites to check API key against their hashes
      const allSatellites = await db
        .select({
          id: satellites.id,
          name: satellites.name,
          satellite_type: satellites.satellite_type,
          team_id: satellites.team_id,
          status: satellites.status,
          api_key_hash: satellites.api_key_hash
        })
        .from(satellites);

      let matchingSatellite = null;

      // Check API key against each satellite's hash
      for (const satellite of allSatellites) {
        if (satellite.api_key_hash) {
          try {
            const isValid = await verify(satellite.api_key_hash, apiKey);
            if (isValid) {
              matchingSatellite = satellite;
              break;
            }
          } catch (error) {
            // Continue checking other satellites if hash verification fails
            request.log.debug({
              operation: 'satellite_auth_hash_error',
              satelliteId: satellite.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Error verifying satellite API key hash');
          }
        }
      }

      if (!matchingSatellite) {
        const errorResponse = {
          success: false,
          error: 'Invalid satellite API key. Please check your API key and try again.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      // Set satellite context for use in route handlers
      request.satellite = {
        id: matchingSatellite.id,
        name: matchingSatellite.name,
        satellite_type: matchingSatellite.satellite_type as 'global' | 'team',
        team_id: matchingSatellite.team_id,
        status: matchingSatellite.status as 'active' | 'inactive' | 'maintenance' | 'error'
      };

      request.log.trace({
        operation: 'satellite_auth_success',
        satelliteId: matchingSatellite.id,
        satelliteName: matchingSatellite.name,
        satelliteType: matchingSatellite.satellite_type,
        teamId: matchingSatellite.team_id
      }, 'Satellite API key validated successfully');

    } catch (error) {
      request.log.error({
        operation: 'satellite_auth_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Satellite authentication middleware error');
      
      const errorResponse = {
        success: false,
        error: 'An error occurred while validating the satellite API key'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  };
}

/**
 * Middleware that accepts either user authentication OR satellite API key
 * This allows endpoints to work with both web users and satellites
 */
export function requireUserOrSatelliteAuth() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if user is already authenticated via cookie (from authHook)
    if (request.user && request.session) {
      request.log.trace({
        operation: 'hybrid_auth_middleware',
        userId: request.user.id,
        authType: 'user_cookie',
      }, 'User authenticated via cookie session');
      return; // Already authenticated via cookie
    }

    // Try OAuth2 Bearer token authentication for users
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // First try OAuth2 token validation
      try {
        const { TokenService } = await import('../services/oauth/tokenService');
        const tokenPayload = await TokenService.verifyAccessToken(token, request.log);
        
        if (tokenPayload) {
          // Set token payload and user for OAuth2 authentication
          request.tokenPayload = tokenPayload;
          request.user = {
            id: tokenPayload.user.id,
            email: tokenPayload.user.email,
            firstName: tokenPayload.user.firstName,
            lastName: tokenPayload.user.lastName,
            authType: 'oauth2',
            githubId: null
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any; // Cast to any to avoid type conflicts with Lucia User type

          request.log.debug({
            operation: 'hybrid_auth_middleware',
            userId: tokenPayload.user.id,
            authType: 'oauth2',
            clientId: tokenPayload.clientId,
          }, 'User authenticated via OAuth2 Bearer token');
          return; // Successfully authenticated via OAuth2
        }
      } catch (error) {
        request.log.debug({
          operation: 'hybrid_auth_middleware',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'OAuth2 token validation failed, trying satellite auth');
      }

      // OAuth2 failed, try satellite API key authentication
      try {
        const db = getDb();

        // Get all satellites to check API key against their hashes
        const allSatellites = await db
          .select({
            id: satellites.id,
            name: satellites.name,
            satellite_type: satellites.satellite_type,
            team_id: satellites.team_id,
            status: satellites.status,
            api_key_hash: satellites.api_key_hash
          })
          .from(satellites);

        let matchingSatellite = null;

        // Check API key against each satellite's hash
        for (const satellite of allSatellites) {
          if (satellite.api_key_hash) {
            try {
              const isValid = await verify(satellite.api_key_hash, token);
              if (isValid) {
                matchingSatellite = satellite;
                break;
              }
            } catch (error) {
              // Continue checking other satellites if hash verification fails
              request.log.debug({
                operation: 'hybrid_auth_satellite_hash_error',
                satelliteId: satellite.id,
                error: error instanceof Error ? error.message : 'Unknown error'
              }, 'Error verifying satellite API key hash');
            }
          }
        }

        if (matchingSatellite) {
          // Set satellite context for satellite authentication
          request.satellite = {
            id: matchingSatellite.id,
            name: matchingSatellite.name,
            satellite_type: matchingSatellite.satellite_type as 'global' | 'team',
            team_id: matchingSatellite.team_id,
            status: matchingSatellite.status as 'active' | 'inactive' | 'maintenance' | 'error'
          };

          request.log.debug({
            operation: 'hybrid_auth_middleware',
            satelliteId: matchingSatellite.id,
            authType: 'satellite_api_key',
          }, 'Satellite authenticated via API key');
          return; // Successfully authenticated via satellite API key
        }
      } catch (error) {
        request.log.debug({
          operation: 'hybrid_auth_middleware',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Satellite API key validation failed');
      }
    }

    // Neither user nor satellite authentication succeeded
    const errorResponse = {
      success: false,
      error: 'Authentication required. Please provide either a valid session cookie, OAuth2 Bearer token, or satellite API key.'
    };
    const jsonString = JSON.stringify(errorResponse);
    return reply.status(401).type('application/json').send(jsonString);
  };
}
