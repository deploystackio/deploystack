import { type FastifyInstance } from 'fastify';
import { getDb } from '../../db';
import { satellites, authUser } from '../../db/schema.sqlite';
import { generateId } from 'lucia';
import { hash } from '@node-rs/argon2';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';

// Reusable Schema Constants
const REGISTER_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    name: { 
      type: 'string', 
      minLength: 1,
      maxLength: 100,
      description: 'Human-readable satellite name (e.g., "dev-satellite-001")'
    },
    capabilities: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of supported MCP server types'
    },
    system_info: {
      type: 'object',
      properties: {
        os: { type: 'string' },
        arch: { type: 'string' },
        node_version: { type: 'string' },
        memory_mb: { type: 'number' }
      },
      description: 'Hardware and OS information'
    }
  },
  required: ['name', 'capabilities'],
  additionalProperties: false
} as const;

const REGISTER_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    satellite: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique satellite identifier' },
        name: { type: 'string', description: 'Satellite name' },
        api_key: { type: 'string', description: 'API key for authentication (store securely)' }
      },
      required: ['id', 'name', 'api_key']
    },
    message: { type: 'string' }
  },
  required: ['success', 'satellite', 'message']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces
interface RegisterRequest {
  name: string;
  capabilities: string[];
  system_info?: {
    os: string;
    arch: string;
    node_version: string;
    memory_mb: number;
  };
}

interface RegisterSuccessResponse {
  success: boolean;
  satellite: {
    id: string;
    name: string;
    api_key: string;
  };
  message: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function satelliteRegisterRoute(server: FastifyInstance) {
  // POST /api/satellites/register - Register a new satellite (no authentication for now)
  server.post('/satellites/register', {
    // No preValidation - this is a public endpoint for now (as requested)
    schema: {
      tags: ['Satellites'],
      summary: 'Register a new satellite',
      description: 'Registers a new satellite with the backend. All satellites are registered as global and inactive by default - admin activation required. No authentication required for now. Requires Content-Type: application/json header when sending request body.',
      
      body: REGISTER_REQUEST_SCHEMA,
      
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: REGISTER_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        201: {
          ...REGISTER_SUCCESS_RESPONSE_SCHEMA,
          description: 'Satellite registered successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid input'
        },
        409: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Conflict - Satellite name already exists'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    const db = getDb();
    const registrationData = request.body as RegisterRequest;

    try {
      // Generate API key (32 bytes, base64url encoded)
      const apiKey = randomBytes(32).toString('base64url');
      const apiKeyHash = await hash(apiKey);

      // Check if satellite name already exists globally (all satellites are global by default)
      const existingSatellite = await db
        .select()
        .from(satellites)
        .where(eq(satellites.name, registrationData.name))
        .limit(1);

      let satelliteId: string;
      let isUpdate = false;

      if (existingSatellite.length > 0) {
        // Satellite exists - update it (upsert behavior)
        satelliteId = existingSatellite[0].id;
        isUpdate = true;

        // Update existing satellite record with default values
        await db
          .update(satellites)
          .set({
            satellite_type: 'global', // Always set to global
            team_id: null, // Always null for global satellites
            status: 'inactive', // Always inactive until admin activates
            capabilities: JSON.stringify(registrationData.capabilities),
            api_key_hash: apiKeyHash,
            system_info: registrationData.system_info ? JSON.stringify(registrationData.system_info) : null,
            config: JSON.stringify({}), // Reset config on re-registration
            updated_at: new Date()
          })
          .where(eq(satellites.id, satelliteId));

        request.log.info({
          operation: 'satellite_re_registration',
          satelliteId,
          name: registrationData.name,
          satellite_type: 'global',
          team_id: null,
          status: 'inactive',
          capabilities: registrationData.capabilities
        }, 'Satellite re-registered successfully (updated existing record)');

      } else {
        // Satellite doesn't exist - create new one
        satelliteId = generateId(15);
        isUpdate = false;

        // Find the first user to use as created_by (required by schema)
        const firstUser = await db
          .select({ id: authUser.id })
          .from(authUser)
          .limit(1);

        if (firstUser.length === 0) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'No users found in system. Please create a user account first.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        // Create satellite record with default values
        const newSatellite = {
          id: satelliteId,
          name: registrationData.name,
          satellite_type: 'global' as const, // Always set to global
          team_id: null, // Always null for global satellites
          status: 'inactive' as const, // Always inactive until admin activates
          capabilities: JSON.stringify(registrationData.capabilities),
          api_key_hash: apiKeyHash,
          system_info: registrationData.system_info ? JSON.stringify(registrationData.system_info) : null,
          config: JSON.stringify({}), // Empty config for now
          created_by: firstUser[0].id, // Use first user as creator (system registration)
          created_at: new Date(),
          updated_at: new Date()
        };

        await db.insert(satellites).values(newSatellite);

        request.log.info({
          operation: 'satellite_registration',
          satelliteId,
          name: registrationData.name,
          satellite_type: 'global',
          team_id: null,
          status: 'inactive',
          capabilities: registrationData.capabilities
        }, 'Satellite registered successfully');
      }

      // Return success response (same for both create and update)
      const successResponse: RegisterSuccessResponse = {
        success: true,
        satellite: {
          id: satelliteId,
          name: registrationData.name,
          api_key: apiKey // Return the plain API key (satellite should store this securely)
        },
        message: isUpdate 
          ? `Satellite '${registrationData.name}' re-registered successfully`
          : `Satellite '${registrationData.name}' registered successfully`
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(201).type('application/json').send(jsonString);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      request.log.error({
        operation: 'satellite_registration_error',
        error: errorMessage,
        name: registrationData.name
      }, 'Failed to register satellite');

      const errorResponse: ErrorResponse = {
        success: false,
        error: `Failed to register satellite: ${errorMessage}`
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
