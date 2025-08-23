import { type FastifyInstance } from 'fastify';
import { AuthorizationService } from '../../services/oauth/authorizationService';
import { TokenService } from '../../services/oauth/tokenService';
import {
  AUTHORIZATION_CODE_GRANT_SCHEMA,
  REFRESH_TOKEN_GRANT_SCHEMA,
  AUTHORIZATION_CODE_SCHEMA,
  REDIRECT_URI_SCHEMA,
  CLIENT_ID_SCHEMA,
  CODE_VERIFIER_SCHEMA,
  REFRESH_TOKEN_SCHEMA,
  ACCESS_TOKEN_SCHEMA,
  TOKEN_TYPE_SCHEMA,
  EXPIRES_IN_SCHEMA,
  SCOPE_SCHEMA,
  OAUTH2_ERROR_RESPONSE_SCHEMA,
  DEVICE_INFO_SCHEMA,
  DEVICE_RESPONSE_SCHEMA,
  type OAuth2ErrorResponse
} from './schemas';
import { DeviceService, type DeviceInfo } from '../../services/deviceService';
import { getDb } from '../../db/index';

// Reusable Schema Constants
const TOKEN_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    grant_type: AUTHORIZATION_CODE_GRANT_SCHEMA,
    code: AUTHORIZATION_CODE_SCHEMA,
    redirect_uri: {
      ...REDIRECT_URI_SCHEMA,
      description: 'OAuth2 redirect URI, must match the one used in authorization'
    },
    client_id: CLIENT_ID_SCHEMA,
    code_verifier: CODE_VERIFIER_SCHEMA,
    device_info: {
      ...DEVICE_INFO_SCHEMA,
      description: 'Optional device information for automatic device registration during login'
    }
  },
  required: ['grant_type', 'code', 'redirect_uri', 'client_id', 'code_verifier'],
  additionalProperties: false
} as const;

const REFRESH_TOKEN_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    grant_type: REFRESH_TOKEN_GRANT_SCHEMA,
    refresh_token: REFRESH_TOKEN_SCHEMA,
    client_id: CLIENT_ID_SCHEMA
  },
  required: ['grant_type', 'refresh_token', 'client_id'],
  additionalProperties: false
} as const;

const TOKEN_REQUEST_BODY_SCHEMA = {
  oneOf: [
    TOKEN_REQUEST_SCHEMA,
    REFRESH_TOKEN_REQUEST_SCHEMA
  ]
} as const;

const TOKEN_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    access_token: ACCESS_TOKEN_SCHEMA,
    token_type: TOKEN_TYPE_SCHEMA,
    expires_in: EXPIRES_IN_SCHEMA,
    refresh_token: {
      ...REFRESH_TOKEN_SCHEMA,
      description: 'Refresh token for obtaining new access tokens'
    },
    scope: {
      ...SCOPE_SCHEMA,
      description: 'Space-separated list of granted scopes'
    },
    device: {
      ...DEVICE_RESPONSE_SCHEMA,
      description: 'Device information if device was registered during login'
    }
  },
  required: ['access_token', 'token_type', 'expires_in', 'refresh_token', 'scope']
} as const;

// TypeScript interfaces
interface TokenRequest {
  grant_type: 'authorization_code';
  code: string;
  redirect_uri: string;
  client_id: string;
  code_verifier: string;
  device_info?: DeviceInfo;
}

interface RefreshTokenRequest {
  grant_type: 'refresh_token';
  refresh_token: string;
  client_id: string;
}

type TokenRequestBody = TokenRequest | RefreshTokenRequest;

interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
  device?: {
    id: string;
    device_name: string;
    hostname: string | null;
    hardware_id: string | null;
    os_type: string | null;
    is_active: boolean;
    is_trusted: boolean;
    created_at: string;
  };
}


export default async function tokenRoute(server: FastifyInstance) {
  server.post('/oauth2/token', {
    schema: {
      tags: ['OAuth2'],
      summary: 'OAuth2 Token Endpoint',
      description: 'Exchanges authorization code for access token using PKCE, or refreshes access token using refresh token. Requires Content-Type: application/json header when sending request body.',
      
      // Fastify validation schema
      body: TOKEN_REQUEST_BODY_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: TOKEN_REQUEST_BODY_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...TOKEN_RESPONSE_SCHEMA,
          description: 'Successful token response'
        },
        400: {
          ...OAUTH2_ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid parameters'
        },
        401: {
          ...OAUTH2_ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Invalid client or credentials'
        },
        500: {
          ...OAUTH2_ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body as TokenRequestBody;

      request.log.debug({
        operation: 'oauth2_token',
        grantType: body.grant_type,
        clientId: body.client_id,
      }, 'OAuth2 token request received');

      // Handle authorization_code grant
      if (body.grant_type === 'authorization_code') {
        const { code, redirect_uri, client_id, code_verifier, device_info } = body;

        // Validate client
        if (!AuthorizationService.validateClient(client_id)) {
          request.log.warn({
            operation: 'oauth2_token',
            clientId: client_id,
            error: 'invalid_client',
          }, 'Invalid OAuth2 client');

          const errorResponse: OAuth2ErrorResponse = {
            error: 'invalid_client',
            error_description: 'Invalid client identifier'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(401).type('application/json').send(jsonString);
        }

        // Verify authorization code and PKCE
        const authCode = await AuthorizationService.verifyAuthorizationCode(
          code,
          code_verifier,
          client_id,
          redirect_uri,
          request.log
        );

        if (!authCode) {
          request.log.warn({
            operation: 'oauth2_token',
            clientId: client_id,
            code: code.substring(0, 8) + '...',
            error: 'invalid_grant',
          }, 'Invalid authorization code or PKCE verification failed');

          const errorResponse: OAuth2ErrorResponse = {
            error: 'invalid_grant',
            error_description: 'Invalid authorization code or PKCE verification failed'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        // Generate tokens
        const accessToken = await TokenService.generateAccessToken(
          authCode.userId,
          authCode.scope,
          client_id,
          request.log
        );

        const refreshToken = await TokenService.generateRefreshToken(
          authCode.userId,
          client_id,
          request.log
        );

        // Handle device registration if device_info is provided
        let registeredDevice = null;
        if (device_info) {
          try {
            const db = getDb();
            const deviceService = new DeviceService(db);
            
            request.log.info({
              operation: 'oauth2_device_registration',
              userId: authCode.userId,
              deviceName: device_info.hostname,
              hardwareId: device_info.hardware_id?.substring(0, 8) + '...',
            }, 'Registering device during OAuth2 login');

            registeredDevice = await deviceService.registerOrUpdateDevice(authCode.userId, device_info);
            
            request.log.info({
              operation: 'oauth2_device_registration',
              userId: authCode.userId,
              deviceId: registeredDevice.id,
              deviceName: registeredDevice.device_name,
              isNewDevice: !registeredDevice.last_login_at || registeredDevice.created_at === registeredDevice.updated_at,
            }, 'Device registered successfully during OAuth2 login');
          } catch (deviceError) {
            // Log device registration error but don't fail the token exchange
            request.log.warn({
              operation: 'oauth2_device_registration',
              userId: authCode.userId,
              error: deviceError,
              errorMessage: deviceError instanceof Error ? deviceError.message : 'Unknown device error',
            }, 'Device registration failed during OAuth2 login - continuing without device context');
          }
        }

        request.log.info({
          operation: 'oauth2_token',
          userId: authCode.userId,
          clientId: client_id,
          scope: authCode.scope,
          deviceRegistered: !!registeredDevice,
        }, 'OAuth2 tokens generated successfully');

        const tokenResponse: TokenResponse = {
          access_token: accessToken,
          token_type: 'Bearer' as const,
          expires_in: 7 * 24 * 3600, // 1 week
          refresh_token: refreshToken,
          scope: authCode.scope
        };

        // Include device information in response if device was registered
        if (registeredDevice) {
          tokenResponse.device = {
            id: registeredDevice.id,
            device_name: registeredDevice.device_name,
            hostname: registeredDevice.hostname,
            hardware_id: registeredDevice.hardware_id,
            os_type: registeredDevice.os_type,
            is_active: registeredDevice.is_active,
            is_trusted: registeredDevice.is_trusted,
            created_at: registeredDevice.created_at.toISOString(),
          };
        }

        const jsonString = JSON.stringify(tokenResponse);
        return reply.status(200).type('application/json').send(jsonString);
      }

      // Handle refresh_token grant
      if (body.grant_type === 'refresh_token') {
        const { refresh_token, client_id } = body;

        // Validate client
        if (!AuthorizationService.validateClient(client_id)) {
          request.log.warn({
            operation: 'oauth2_token_refresh',
            clientId: client_id,
            error: 'invalid_client',
          }, 'Invalid OAuth2 client');

          const errorResponse: OAuth2ErrorResponse = {
            error: 'invalid_client',
            error_description: 'Invalid client identifier'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(401).type('application/json').send(jsonString);
        }

        // Refresh tokens
        const tokenResponse = await TokenService.refreshAccessToken(
          refresh_token,
          client_id,
          request.log
        );

        if (!tokenResponse) {
          request.log.warn({
            operation: 'oauth2_token_refresh',
            clientId: client_id,
            error: 'invalid_grant',
          }, 'Invalid or expired refresh token');

          const errorResponse: OAuth2ErrorResponse = {
            error: 'invalid_grant',
            error_description: 'Invalid or expired refresh token'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        request.log.info({
          operation: 'oauth2_token_refresh',
          clientId: client_id,
        }, 'OAuth2 tokens refreshed successfully');

        const jsonString = JSON.stringify(tokenResponse);
        return reply.status(200).type('application/json').send(jsonString);
      }

      // Should not reach here due to schema validation
      const errorResponse: OAuth2ErrorResponse = {
        error: 'unsupported_grant_type',
        error_description: 'Unsupported grant type'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(400).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'oauth2_token',
        error,
      }, 'OAuth2 token error');

      const errorResponse: OAuth2ErrorResponse = {
        error: 'server_error',
        error_description: 'An error occurred processing the token request'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
