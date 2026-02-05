 
import { TokenService } from './tokenService';
import { GlobalSettingsInitService } from '../../global-settings';
import type { FastifyBaseLogger } from 'fastify';

export interface IntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  sub?: string;
  aud?: string[];
  iss?: string;
  exp?: number;
  iat?: number;
  team_id?: string;
  team_name?: string;
  team_role?: string;
  team_permissions?: string[];
  error?: string;
  error_description?: string;
}

export class IntrospectionService {
  /**
   * Introspect team-scoped token for satellites
   * RFC 7662 compliant token introspection with team context
   */
  static async introspectTeamToken(
    token: string,
    expectedTeamId?: string,
    logger?: FastifyBaseLogger
  ): Promise<IntrospectionResponse> {
    try {
      // Validate token using existing TokenService
      const tokenPayload = await TokenService.verifyAccessToken(token, logger);
      
      if (!tokenPayload) {
        logger?.debug({
          operation: 'token_introspection',
          result: 'invalid_token'
        }, 'Token introspection failed - invalid token');
        
        return { active: false };
      }

      // Check team match if expected team provided
      if (expectedTeamId && tokenPayload.team_id !== expectedTeamId) {
        logger?.warn({
          operation: 'token_introspection',
          expectedTeam: expectedTeamId,
          tokenTeam: tokenPayload.team_id,
          result: 'wrong_team'
        }, 'Token introspection failed - wrong team');
        
        return {
          active: false,
          error: 'token_not_for_team',
          error_description: 'Token is not valid for the requested team'
        };
      }

      logger?.debug({
        operation: 'token_introspection',
        userId: tokenPayload.user.id,
        teamId: tokenPayload.team_id,
        clientId: tokenPayload.clientId,
        result: 'success'
      }, 'Token introspection successful');

      // Get dynamic backend URL for issuer
      const backendUrl = await GlobalSettingsInitService.getBackendUrl();

      // Return RFC 7662 compliant response with team context
      return {
        active: true,
        scope: tokenPayload.scope.join(' '),
        client_id: tokenPayload.clientId,
        username: tokenPayload.user.username,
        sub: tokenPayload.user.id,
        aud: tokenPayload.aud || [`deploystack:team:${tokenPayload.team_id}`], // RFC 8707 audience or fallback to generic team
        iss: backendUrl, // Dynamic backend URL
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        iat: Math.floor(Date.now() / 1000),
        team_id: tokenPayload.team_id,
        team_name: tokenPayload.team_name,
        team_role: tokenPayload.team_role,
        team_permissions: tokenPayload.team_permissions
      };

    } catch (error) {
      logger?.error({
        operation: 'token_introspection',
        error,
      }, 'Token introspection error');
      
      return { active: false };
    }
  }
}
