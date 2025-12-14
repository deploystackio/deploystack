import { type FastifyInstance } from 'fastify';
import { requireTeamPermission } from '../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../db';
import { eq, and, or, isNull } from 'drizzle-orm';

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

const TEAM_ID_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    teamId: {
      type: 'string',
      minLength: 1,
      description: 'Team ID'
    }
  },
  required: ['teamId'],
  additionalProperties: false
} as const;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

const SATELLITE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Satellite unique identifier' },
    name: { type: 'string', description: 'User-friendly satellite name' },
    satellite_type: {
      type: 'string',
      enum: ['global', 'team'],
      description: 'Satellite deployment type'
    },
    status: {
      type: 'string',
      enum: ['active'],
      description: 'Satellite status (only active satellites are returned)'
    },
    capabilities: {
      type: 'array',
      items: { type: 'string' },
      description: 'Supported MCP server types and features'
    },
    team_id: {
      type: ['string', 'null'],
      description: 'Team ID (null for global satellites)'
    },
    satellite_url: {
      type: 'string',
      description: 'Publicly accessible satellite URL'
    },
    last_heartbeat: {
      type: ['string', 'null'],
      description: 'ISO 8601 timestamp of last communication'
    }
  },
  required: ['id', 'name', 'satellite_type', 'status', 'capabilities', 'team_id', 'satellite_url']
} as const;

const SATELLITES_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: {
      type: 'object',
      properties: {
        satellites: {
          type: 'array',
          items: SATELLITE_SCHEMA,
          description: 'Array of available satellites (global and team-specific)'
        },
        total_count: {
          type: 'number',
          description: 'Total number of satellites available to the team'
        },
        global_count: {
          type: 'number',
          description: 'Number of global satellites'
        },
        team_count: {
          type: 'number',
          description: 'Number of team-specific satellites'
        }
      },
      required: ['satellites', 'total_count', 'global_count', 'team_count']
    }
  },
  required: ['success', 'data']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false, description: 'Indicates failure' },
    error: { type: 'string', description: 'Error message detailing what went wrong' }
  },
  required: ['success', 'error']
} as const;

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

interface TeamIdParams {
  teamId: string;
}

interface Satellite {
  id: string;
  name: string;
  satellite_type: 'global' | 'team';
  status: 'active';
  capabilities: string[];
  team_id: string | null;
  satellite_url: string;
  last_heartbeat: string | null;
}

interface SatellitesSuccessResponse {
  success: boolean;
  data: {
    satellites: Satellite[];
    total_count: number;
    global_count: number;
    team_count: number;
  };
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

interface SatelliteRecord {
  id: string;
  name: string;
  satellite_type: 'global' | 'team';
  status: 'active' | 'inactive' | 'maintenance' | 'error';
  capabilities: string;
  team_id: string | null;
  satellite_url: string;
  last_heartbeat: Date | null;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getTeamSatellitesRoute(server: FastifyInstance) {
  server.get<{
    Params: TeamIdParams;
  }>('/teams/:teamId/satellites', {
    preValidation: requireTeamPermission('satellites.team.view'),
    schema: {
      tags: ['Teams', 'Satellites'],
      summary: 'Get available satellites for team',
      description: 'Retrieves all active satellites available to the team (global satellites + team-specific satellites). Requires satellites.team.view permission. Only returns active satellites. Sensitive fields like api_key_hash are never exposed.',
      security: [{ cookieAuth: [] }],

      // Fastify validation schema
      params: TEAM_ID_PARAMS_SCHEMA,

      response: {
        200: {
          ...SATELLITES_SUCCESS_RESPONSE_SCHEMA,
          description: 'Satellites retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions or not a team member'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    // TypeScript type assertion (Fastify has already validated)
    const { teamId } = request.params as TeamIdParams;
    const userId = request.user!.id;

    request.log.info({
      operation: 'get_team_satellites',
      teamId,
      userId
    }, 'Retrieving available satellites for team');

    try {
      const db = getDb();
      const { satellites } = getSchema();

      // Query active satellites: global satellites OR team-specific satellites
      // requireTeamPermission already verified team membership
      const satelliteRecords = await db
        .select({
          id: satellites.id,
          name: satellites.name,
          satellite_type: satellites.satellite_type,
          status: satellites.status,
          capabilities: satellites.capabilities,
          team_id: satellites.team_id,
          satellite_url: satellites.satellite_url,
          last_heartbeat: satellites.last_heartbeat
        })
        .from(satellites)
        .where(
          and(
            eq(satellites.status, 'active'),
            or(
              // Global satellites (team_id is NULL)
              and(
                eq(satellites.satellite_type, 'global'),
                isNull(satellites.team_id)
              ),
              // Team-specific satellites (team_id matches)
              and(
                eq(satellites.satellite_type, 'team'),
                eq(satellites.team_id, teamId)
              )
            )
          )
        )
        .orderBy(satellites.satellite_type, satellites.name);

      // Parse capabilities JSON and format response
      const formattedSatellites: Satellite[] = satelliteRecords.map((sat: SatelliteRecord) => {
        let capabilitiesArray: string[] = [];
        try {
          capabilitiesArray = sat.capabilities ? JSON.parse(sat.capabilities) : [];
        } catch (error) {
          request.log.warn({
            operation: 'get_team_satellites',
            satelliteId: sat.id,
            error
          }, 'Failed to parse capabilities JSON, using empty array');
          capabilitiesArray = [];
        }

        return {
          id: sat.id,
          name: sat.name,
          satellite_type: sat.satellite_type as 'global' | 'team',
          status: 'active' as const,
          capabilities: capabilitiesArray,
          team_id: sat.team_id,
          satellite_url: sat.satellite_url,
          last_heartbeat: sat.last_heartbeat ? sat.last_heartbeat.toISOString() : null
        };
      });

      // Calculate counts
      const globalCount = formattedSatellites.filter(s => s.satellite_type === 'global').length;
      const teamCount = formattedSatellites.filter(s => s.satellite_type === 'team').length;
      const totalCount = formattedSatellites.length;

      request.log.info({
        operation: 'get_team_satellites',
        teamId,
        userId,
        totalCount,
        globalCount,
        teamCount
      }, 'Retrieved satellites for team');

      const successResponse: SatellitesSuccessResponse = {
        success: true,
        data: {
          satellites: formattedSatellites,
          total_count: totalCount,
          global_count: globalCount,
          team_count: teamCount
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'get_team_satellites',
        error,
        teamId,
        userId
      }, 'Failed to retrieve team satellites');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      const errorResponse: ErrorResponse = {
        success: false,
        error: errorMessage
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
