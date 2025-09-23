import { FastifyRequest, FastifyReply } from 'fastify';
import { SatelliteTokenService } from '../services/satelliteTokenService';
import type { SatelliteRegistrationToken } from '../types/satellite';

export interface RegistrationTokenRequest extends FastifyRequest {
  registrationToken?: {
    tokenRecord: SatelliteRegistrationToken;
    rawToken: string;
  };
}

/**
 * Middleware to validate registration tokens during satellite registration
 */
export async function validateRegistrationToken(
  request: RegistrationTokenRequest,
  reply: FastifyReply
) {
  try {
    // Extract Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const errorResponse = {
        success: false,
        error: 'registration_token_required',
        message: 'Registration token required in Authorization header',
        instructions: 'Set Authorization: Bearer <registration_token> header'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(401).type('application/json').send(jsonString);
    }

    // Extract token from Bearer header
    const token = authHeader.substring('Bearer '.length);

    // Validate token
    const validation = await SatelliteTokenService.validateRegistrationToken(token, request.log);
    
    if (!validation.valid) {
      // Log security event
      request.log.warn({
        action: 'invalid_registration_token',
        token_prefix: token.substring(0, 30) + '...',
        error: validation.error,
        ip: request.ip,
        user_agent: request.headers['user-agent']
      }, 'Invalid registration token used');

      const errorResponse = {
        success: false,
        error: 'invalid_registration_token',
        message: validation.error || 'Invalid registration token',
        instructions: 'Generate a new registration token from the admin interface'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(401).type('application/json').send(jsonString);
    }

    // Attach validated token to request for use in route handler
    request.registrationToken = {
      tokenRecord: validation.tokenRecord!,
      rawToken: token
    };

  } catch (error) {
    request.log.error(error, 'Registration token validation failed');
    const errorResponse = {
      success: false,
      error: 'token_validation_error',
      message: 'Token validation failed'
    };
    const jsonString = JSON.stringify(errorResponse);
    return reply.status(500).type('application/json').send(jsonString);
  }
}
