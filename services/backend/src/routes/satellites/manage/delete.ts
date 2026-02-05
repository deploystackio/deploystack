import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { eq, count } from 'drizzle-orm';
import { getDb, getSchema } from '../../../db';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { EVENT_NAMES } from '../../../events';
import type { EventContext } from '../../../events/types';

// Reusable schema constants
const SATELLITE_ID_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    satelliteId: {
      type: 'string',
      minLength: 1,
      description: 'Satellite ID is required'
    }
  },
  required: ['satelliteId'],
  additionalProperties: false
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' }
  },
  required: ['success', 'message']
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
interface SatelliteIdParams {
  satelliteId: string;
}

interface SuccessResponse {
  success: boolean;
  message: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function deleteSatelliteRoute(server: FastifyInstance) {
  server.delete<{ Params: SatelliteIdParams }>(
    '/satellites/manage/:satelliteId',
    {
      preValidation: requirePermission('satellites.delete'),
      schema: {
        tags: ['Satellite Management'],
        summary: 'Delete satellite',
        description: 'Delete a satellite. Requires global_admin role. Satellite must be inactive and have no MCP installations. No Content-Type header required for this DELETE request.',
        security: [{ cookieAuth: [] }],

        params: SATELLITE_ID_PARAM_SCHEMA,

        response: {
          200: {
            ...SUCCESS_RESPONSE_SCHEMA,
            description: 'Satellite deleted successfully'
          },
          400: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Bad Request - Satellite is not inactive'
          },
          401: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Unauthorized'
          },
          403: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Forbidden - Insufficient permissions'
          },
          404: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Not Found - Satellite does not exist'
          },
          409: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Conflict - Satellite has active MCP installations'
          },
          500: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Internal Server Error'
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: SatelliteIdParams }>, reply: FastifyReply) => {
      try {
        const { satelliteId } = request.params;

        request.log.info({
          operation: 'delete_satellite',
          userId: request.user?.id,
          satelliteId
        }, 'Deleting satellite');

        const db = getDb();
        const { satellites, mcpServerInstallations } = getSchema();

        // 1. Check if satellite exists and get its status
        const existingSatellite = await db
          .select({
            id: satellites.id,
            name: satellites.name,
            satellite_type: satellites.satellite_type,
            status: satellites.status
          })
          .from(satellites)
          .where(eq(satellites.id, satelliteId))
          .limit(1);

        if (existingSatellite.length === 0) {
          request.log.warn({
            operation: 'delete_satellite',
            userId: request.user?.id,
            satelliteId
          }, 'Satellite not found');

          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Satellite not found'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(404).type('application/json').send(jsonString);
        }

        const satellite = existingSatellite[0];

        // 2. Validation Check: Satellite must be inactive
        if (satellite.status !== 'inactive') {
          request.log.warn({
            operation: 'delete_satellite',
            userId: request.user?.id,
            satelliteId,
            currentStatus: satellite.status
          }, 'Cannot delete satellite - not inactive');

          const errorResponse: ErrorResponse = {
            success: false,
            error: `Satellite must be inactive before deletion. Current status: ${satellite.status}`
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        // 3. Validation Check: No MCP installations attached
        const installationCount = await db
          .select({ count: count() })
          .from(mcpServerInstallations)
          .where(eq(mcpServerInstallations.satellite_id, satelliteId));

        const totalInstallations = installationCount[0]?.count || 0;

        if (totalInstallations > 0) {
          request.log.warn({
            operation: 'delete_satellite',
            userId: request.user?.id,
            satelliteId,
            installationCount: totalInstallations
          }, 'Cannot delete satellite - has active MCP installations');

          const errorResponse: ErrorResponse = {
            success: false,
            error: `Satellite has ${totalInstallations} MCP installation(s). Remove all installations before deleting the satellite.`
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(409).type('application/json').send(jsonString);
        }

        // 4. Delete the satellite
        const deleteResult = await db
          .delete(satellites)
          .where(eq(satellites.id, satelliteId))
          .returning({
            id: satellites.id,
            name: satellites.name,
            satellite_type: satellites.satellite_type
          });

        if (deleteResult.length === 0) {
          request.log.error({
            operation: 'delete_satellite',
            userId: request.user?.id,
            satelliteId
          }, 'Failed to delete satellite');

          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Failed to delete satellite'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(500).type('application/json').send(jsonString);
        }

        const deletedSatellite = deleteResult[0];

        request.log.info({
          operation: 'delete_satellite',
          userId: request.user?.id,
          satelliteId,
          satelliteName: deletedSatellite.name
        }, `Successfully deleted satellite ${deletedSatellite.name}`);

        // 5. Emit SATELLITE_DELETED event
        try {
          const eventContext: EventContext = {
            db,
            logger: request.log,
            user: {
              id: request.user!.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              roleId: (request.user as any).roleId || 'global_admin'
            },
            request: {
              ip: request.ip,
              userAgent: request.headers['user-agent'],
              requestId: request.id
            },
            timestamp: new Date()
          };

          server.eventBus.emitWithContext(
            EVENT_NAMES.SATELLITE_DELETED,
            {
              satellite: {
                id: deletedSatellite.id,
                name: deletedSatellite.name,
                satellite_type: deletedSatellite.satellite_type
              },
              deletedBy: {
                id: request.user!.id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                email: (request.user as any).email
              },
              metadata: {
                ip: request.ip
              }
            },
            eventContext
          );
          request.log.info(`SATELLITE_DELETED event emitted for satellite: ${deletedSatellite.id}`);
        } catch (eventError) {
          request.log.error(eventError, `Failed to emit SATELLITE_DELETED event for satellite ${deletedSatellite.id}`);
          // Don't fail deletion if event emission fails
        }

        const successResponse: SuccessResponse = {
          success: true,
          message: `Satellite "${deletedSatellite.name}" deleted successfully`
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        request.log.error({
          operation: 'delete_satellite',
          userId: request.user?.id,
          satelliteId: request.params?.satelliteId,
          error
        }, `Error deleting satellite: ${error instanceof Error ? error.message : 'Unknown error'}`);

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to delete satellite'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
