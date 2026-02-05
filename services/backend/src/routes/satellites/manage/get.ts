import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb, getSchema } from '../../../db';
import { requirePermission } from '../../../middleware/roleMiddleware';

// Reusable Schema Constants
const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        satellite_type: { type: 'string', enum: ['global', 'team'] },
        status: { type: 'string', enum: ['active', 'inactive', 'maintenance', 'error'] },
        capabilities: { type: 'array', items: { type: 'string' } },
        satellite_url: { type: 'string' },
        region: { type: ['string', 'null'] },
        last_heartbeat: { type: ['string', 'null'] },
        system_info: {
          type: ['object', 'null'],
          additionalProperties: true
        },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
        team: {
          type: ['object', 'null'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' }
          }
        },
        created_by_user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' }
          }
        }
      }
    }
  },
  required: ['success', 'data']
} as const;

interface GetSatelliteParams {
  Params: {
    id: string;
  };
}

export default async function getSatelliteRoute(server: FastifyInstance) {
  server.get<GetSatelliteParams>(
    '/satellites/manage/:id',
    {
      preValidation: requirePermission('satellites.view'),
      schema: {
        tags: ['Satellite Management'],
        summary: 'Get satellite by ID',
        description: 'Get detailed information about a specific satellite. Requires global_admin role.',
        security: [{ cookieAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Satellite ID'
            }
          },
          required: ['id']
        },
        response: {
          200: {
            ...SUCCESS_RESPONSE_SCHEMA,
            description: 'Satellite details retrieved successfully'
          },
          404: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Satellite not found'
          },
          401: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Unauthorized'
          },
          403: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Forbidden - Insufficient permissions'
          },
          500: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Internal server error'
          }
        }
      }
    },
    async (request: FastifyRequest<GetSatelliteParams>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        request.log.info({
          operation: 'get_satellite',
          userId: request.user?.id,
          satelliteId: id
        }, 'Getting satellite details');

        const db = getDb();
        const { satellites, teams, authUser } = getSchema();

        // Get satellite with related data
        const results = await db
          .select({
            id: satellites.id,
            name: satellites.name,
            satellite_type: satellites.satellite_type,
            status: satellites.status,
            capabilities: satellites.capabilities,
            satellite_url: satellites.satellite_url,
            region: satellites.region,
            last_heartbeat: satellites.last_heartbeat,
            system_info: satellites.system_info,
            created_at: satellites.created_at,
            updated_at: satellites.updated_at,
            team_id: satellites.team_id,
            team_name: teams.name,
            team_slug: teams.slug,
            created_by_id: satellites.created_by,
            created_by_username: authUser.username,
            created_by_email: authUser.email
          })
          .from(satellites)
          .leftJoin(teams, eq(satellites.team_id, teams.id))
          .leftJoin(authUser, eq(satellites.created_by, authUser.id))
          .where(eq(satellites.id, id))
          .limit(1);

        if (results.length === 0) {
          request.log.warn({
            operation: 'get_satellite',
            userId: request.user?.id,
            satelliteId: id
          }, 'Satellite not found');

          const errorResponse = {
            success: false,
            error: 'Satellite not found'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(404).type('application/json').send(jsonString);
        }

        const row = results[0];

        // Parse system_info - handle both string and object types
        let parsedSystemInfo = null;
        if (row.system_info) {
          try {
            if (typeof row.system_info === 'string') {
              // Parse JSON string
              const parsed = JSON.parse(row.system_info);
              // Check if it's an empty object
              parsedSystemInfo = Object.keys(parsed).length > 0 ? parsed : null;
            } else {
              // Already an object
              parsedSystemInfo = Object.keys(row.system_info).length > 0 ? row.system_info : null;
            }
          } catch (error) {
            request.log.warn({ satelliteId: id, error }, 'Failed to parse system_info');
            parsedSystemInfo = null;
          }
        }

        // Transform result to include nested objects
        const satellite = {
          id: row.id,
          name: row.name,
          satellite_type: row.satellite_type,
          status: row.status,
          capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
          satellite_url: row.satellite_url,
          region: row.region,
          last_heartbeat: row.last_heartbeat?.toISOString() || null,
          system_info: parsedSystemInfo,
          created_at: row.created_at.toISOString(),
          updated_at: row.updated_at.toISOString(),
          team: row.team_id ? {
            id: row.team_id,
            name: row.team_name!,
            slug: row.team_slug!
          } : null,
          created_by_user: {
            id: row.created_by_id,
            username: row.created_by_username!,
            email: row.created_by_email!
          }
        };

        request.log.info({
          operation: 'get_satellite',
          userId: request.user?.id,
          satelliteId: id
        }, `✅ Successfully retrieved satellite: ${satellite.name}`);

        const successResponse = {
          success: true,
          data: satellite
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        request.log.error({
          operation: 'get_satellite',
          userId: request.user?.id,
          satelliteId: request.params.id,
          error
        }, `Error getting satellite: ${error instanceof Error ? error.message : 'Unknown error'}`);

        const errorResponse = {
          success: false,
          error: 'Failed to get satellite'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
