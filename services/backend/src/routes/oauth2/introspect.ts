import { type FastifyInstance } from 'fastify';
import { IntrospectionService } from '../../services/oauth/introspectionService';

// Reusable Schema Constants
const INTROSPECTION_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    token: {
      type: 'string',
      description: 'The token to introspect'
    },
    expected_team_id: {
      type: 'string',
      description: 'Expected team ID for validation'
    }
  },
  required: ['token'],
  additionalProperties: false
} as const;

const INTROSPECTION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    active: { type: 'boolean' },
    scope: { type: 'string' },
    client_id: { type: 'string' },
    username: { type: 'string' },
    sub: { type: 'string' },
    aud: { type: 'array', items: { type: 'string' } },
    iss: { type: 'string' },
    exp: { type: 'number' },
    iat: { type: 'number' },
    team_id: { type: 'string' },
    team_name: { type: 'string' },
    team_role: { type: 'string' },
    team_permissions: { type: 'array', items: { type: 'string' } },
    error: { type: 'string' },
    error_description: { type: 'string' }
  },
  required: ['active']
} as const;

// TypeScript interfaces
interface IntrospectionRequest {
  token: string;
  expected_team_id?: string;
}

export default async function introspectRoute(server: FastifyInstance) {
  server.post('/oauth2/introspect', {
    schema: {
      tags: ['OAuth2'],
      summary: 'OAuth2 Token Introspection Endpoint',
      description: 'RFC 7662 compliant token introspection for resource servers (satellites). Requires Content-Type: application/json header when sending request body.',
      
      // Fastify validation schema
      body: INTROSPECTION_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: INTROSPECTION_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...INTROSPECTION_RESPONSE_SCHEMA,
          description: 'Token introspection response'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { token, expected_team_id } = request.body as IntrospectionRequest;

      request.log.debug({
        operation: 'oauth2_introspect',
        expectedTeamId: expected_team_id,
      }, 'Token introspection request received');

      const result = await IntrospectionService.introspectTeamToken(
        token,
        expected_team_id,
        request.log
      );

      const jsonString = JSON.stringify(result);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'oauth2_introspect',
        error,
      }, 'Token introspection error');

      const errorResponse = {
        active: false
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(200).type('application/json').send(jsonString);
    }
  });
}
