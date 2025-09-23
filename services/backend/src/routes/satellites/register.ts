import { type FastifyInstance } from 'fastify';
import { validateRegistrationToken, RegistrationTokenRequest } from '../../middleware/registrationTokenMiddleware';
import { SatelliteTokenService } from '../../services/satelliteTokenService';
import { nanoid } from 'nanoid';
import { hash } from '@node-rs/argon2';
import { getDb } from '../../db';
import { satellites } from '../../db/schema.sqlite';
import { eq } from 'drizzle-orm';

// Reusable Schema Constants
const SATELLITE_REGISTRATION_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 10,
      maxLength: 32,
      pattern: '^[a-z0-9_-]+$',
      description: 'Satellite name (10-32 chars, lowercase/numbers/hyphens/underscores only)'
    },
    capabilities: {
      type: 'array',
      items: { type: 'string' },
      default: ['stdio', 'http', 'sse'],
      description: 'Satellite capabilities'
    },
    system_info: {
      type: 'object',
      properties: {
        os: { type: 'string' },
        arch: { type: 'string' },
        node_version: { type: 'string' },
        memory_mb: { type: 'number' }
      },
      description: 'System information (optional)'
    }
  },
  required: ['name'],
  additionalProperties: false
} as const;

const REGISTRATION_SUCCESS_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    satellite: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        satellite_type: { type: 'string' },
        team_id: { type: 'string', nullable: true },
        status: { type: 'string' },
        api_key: { type: 'string' }
      },
      required: ['id', 'name', 'satellite_type', 'status', 'api_key']
    },
    message: { type: 'string' }
  },
  required: ['success', 'satellite', 'message']
} as const;

const REGISTRATION_ERROR_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' },
    message: { type: 'string' },
    instructions: { type: 'string' }
  },
  required: ['success', 'error', 'message']
} as const;

const REGISTRATION_STATUS_SCHEMA = {
  type: 'object',
  properties: {
    registration_method: { type: 'string' },
    token_required: { type: 'boolean' },
    supported_prefixes: {
      type: 'array',
      items: { type: 'string' }
    },
    instructions: { type: 'string' }
  },
  required: ['registration_method', 'token_required', 'supported_prefixes', 'instructions']
} as const;

// TypeScript interfaces
interface RegistrationRequest {
  name: string;
  capabilities?: string[];
  system_info?: {
    os: string;
    arch: string;
    node_version: string;
    memory_mb: number;
  };
}

interface RegistrationSuccessResponse {
  success: boolean;
  satellite: {
    id: string;
    name: string;
    satellite_type: string;
    team_id: string | null;
    status: string;
    api_key: string;
  };
  message: string;
}

interface RegistrationErrorResponse {
  success: boolean;
  error: string;
  message: string;
  instructions?: string;
}

export default async function satelliteRegisterRoute(server: FastifyInstance) {
  
  /**
   * Satellite Registration Endpoint (Now Secured with Tokens)
   * 
   * BREAKING CHANGE: Now requires registration token in Authorization header
   */
  server.post('/satellites/register', {
    preValidation: [validateRegistrationToken],
    schema: {
      tags: ['Satellite Registration'],
      summary: 'Register satellite with token',
      description: 'Registers a satellite using a valid registration token. BREAKING CHANGE: Now requires Authorization: Bearer <token> header. Requires Content-Type: application/json header when sending request body.',
      security: [{ bearerAuth: [] }],
      
      headers: {
        type: 'object',
        properties: {
          authorization: {
            type: 'string',
            pattern: '^Bearer deploystack_satellite_(global|team)_',
            description: 'Registration token in Bearer format'
          }
        },
        required: ['authorization'],
        additionalProperties: true
      },
      
      body: SATELLITE_REGISTRATION_SCHEMA,
      
      response: {
        200: {
          ...REGISTRATION_SUCCESS_SCHEMA,
          description: 'Satellite registered successfully'
        },
        400: {
          ...REGISTRATION_ERROR_SCHEMA,
          description: 'Bad Request - Invalid input'
        },
        401: {
          ...REGISTRATION_ERROR_SCHEMA,
          description: 'Unauthorized - Invalid or missing registration token'
        },
        500: {
          ...REGISTRATION_ERROR_SCHEMA,
          description: 'Internal server error'
        }
      }
    }
  }, async (request: RegistrationTokenRequest, reply) => {
    const db = getDb();
    
    try {
      const { name, capabilities = ['stdio', 'http', 'sse'], system_info } = request.body as RegistrationRequest;
      const tokenData = request.registrationToken!;
      
      // Extract token scope and determine satellite type
      const tokenRecord = tokenData.tokenRecord;
      const satelliteType = tokenRecord.token_type; // 'global' or 'team'
      const teamId = tokenRecord.team_id; // null for global, team ID for team tokens
      
      // Check if satellite name already exists
      const existingSatellites = await db.select()
        .from(satellites)
        .where(eq(satellites.name, name));

      let satelliteId: string;
      let isUpdate = false;

      if (existingSatellites.length > 0) {
        // Update existing satellite (upsert behavior)
        satelliteId = existingSatellites[0].id;
        isUpdate = true;
      } else {
        // Create new satellite
        satelliteId = nanoid();
      }

      // Generate permanent API key for satellite
      const apiKey = `deploystack_satellite_api_${satelliteType}_${nanoid(32)}`;
      const apiKeyHash = await hash(apiKey);

      // Prepare satellite data
      const satelliteData = {
        id: satelliteId,
        name: name,
        satellite_type: satelliteType,
        team_id: teamId,
        status: 'inactive' as const, // Requires admin activation
        capabilities: JSON.stringify(capabilities),
        api_key_hash: apiKeyHash,
        system_info: system_info ? JSON.stringify(system_info) : null,
        config: JSON.stringify({}),
        last_heartbeat: null,
        created_by: tokenRecord.created_by,
        created_at: new Date(),
        updated_at: new Date()
      };

      if (isUpdate) {
        // Update existing satellite
        await db.update(satellites)
          .set({
            satellite_type: satelliteData.satellite_type,
            team_id: satelliteData.team_id,
            status: satelliteData.status,
            capabilities: satelliteData.capabilities,
            api_key_hash: satelliteData.api_key_hash,
            system_info: satelliteData.system_info,
            updated_at: new Date()
          })
          .where(eq(satellites.id, satelliteId));
      } else {
        // Insert new satellite
        await db.insert(satellites).values(satelliteData);
      }

      // Mark registration token as used
      await SatelliteTokenService.markTokenAsUsed(tokenRecord.id, satelliteId);

      // Audit log
      server.log.info({
        action: isUpdate ? 'satellite_re_registered' : 'satellite_registered',
        satellite_id: satelliteId,
        satellite_name: name,
        satellite_type: satelliteType,
        team_id: teamId,
        token_id: tokenRecord.id,
        created_by: tokenRecord.created_by,
        ip: request.ip,
        user_agent: request.headers['user-agent']
      }, `Satellite ${isUpdate ? 're-' : ''}registered successfully`);

      const successResponse: RegistrationSuccessResponse = {
        success: true,
        satellite: {
          id: satelliteId,
          name: name,
          satellite_type: satelliteType,
          team_id: teamId,
          status: 'inactive',
          api_key: apiKey // Return plaintext API key (only time it's exposed)
        },
        message: `Satellite ${isUpdate ? 're-' : ''}registered successfully. Status set to 'inactive' - admin activation required.`
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      server.log.error(error, 'Satellite registration failed');
      const errorResponse: RegistrationErrorResponse = {
        success: false,
        error: 'registration_failed',
        message: 'Satellite registration failed'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  /**
   * Registration Status Check (for diagnostics)
   */
  server.get('/satellites/register/status', {
    schema: {
      tags: ['Satellite Registration'],
      summary: 'Get registration status',
      description: 'Returns information about the current registration method and requirements.',
      
      response: {
        200: {
          ...REGISTRATION_STATUS_SCHEMA,
          description: 'Registration status information'
        }
      }
    }
  }, async (request, reply) => {
    const statusResponse = {
      registration_method: 'token_based',
      token_required: true,
      supported_prefixes: [
        'deploystack_satellite_global_',
        'deploystack_satellite_team_'
      ],
      instructions: 'Include registration token in Authorization: Bearer <token> header'
    };
    const jsonString = JSON.stringify(statusResponse);
    return reply.status(200).type('application/json').send(jsonString);
  });
}
