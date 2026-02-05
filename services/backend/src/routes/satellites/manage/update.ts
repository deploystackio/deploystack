import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
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

const UPDATE_SATELLITE_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      description: 'Satellite name'
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive', 'maintenance', 'error'],
      description: 'Satellite status'
    },
    capabilities: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of supported MCP server types'
    },
    satellite_url: {
      type: 'string',
      format: 'uri',
      description: 'Satellite URL (e.g., http://127.0.0.1:3001)'
    },
    region: {
      type: 'string',
      description: 'Satellite region (e.g., us-east-1, eu-central-1)'
    }
  },
  additionalProperties: false
} as const;

const UPDATE_SATELLITE_SUCCESS_RESPONSE_SCHEMA = {
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
        region: { type: 'string' },
        updated_at: { type: 'string' }
      }
    }
  },
  required: ['success', 'data']
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

interface UpdateSatelliteRequest {
  name?: string;
  status?: 'active' | 'inactive' | 'maintenance' | 'error';
  capabilities?: string[];
  satellite_url?: string;
  region?: string;
}

interface UpdateSatelliteSuccessResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    satellite_type: 'global' | 'team';
    status: 'active' | 'inactive' | 'maintenance' | 'error';
    capabilities: string[];
    satellite_url: string;
    region: string | null;
    updated_at: string;
  };
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function updateSatelliteRoute(server: FastifyInstance) {
  server.patch<{ Params: SatelliteIdParams; Body: UpdateSatelliteRequest }>(
    '/satellites/manage/:satelliteId',
    {
      preValidation: requirePermission('satellites.manage'),
      schema: {
        tags: ['Satellite Management'],
        summary: 'Update satellite',
        description: 'Update satellite status and capabilities. Requires global_admin role. Requires Content-Type: application/json header when sending request body.',
        security: [{ cookieAuth: [] }],

        params: SATELLITE_ID_PARAM_SCHEMA,
        body: UPDATE_SATELLITE_REQUEST_SCHEMA,

        response: {
          200: {
            ...UPDATE_SATELLITE_SUCCESS_RESPONSE_SCHEMA,
            description: 'Satellite updated successfully'
          },
          400: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Bad Request - Invalid input'
          },
          401: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Unauthorized'
          },
          403: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Forbidden'
          },
          404: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Not Found'
          },
          500: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Internal Server Error'
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: SatelliteIdParams; Body: UpdateSatelliteRequest }>, reply: FastifyReply) => {
      try {
        const { satelliteId } = request.params;
        const updateData = request.body;

        request.log.info({
          operation: 'update_satellite',
          userId: request.user?.id,
          satelliteId,
          updateFields: Object.keys(updateData)
        }, 'Updating satellite');

        // Validate that at least one field is provided
        if (!updateData.name && !updateData.status && !updateData.capabilities && !updateData.satellite_url && !updateData.region) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'At least one field (name, status, capabilities, satellite_url, or region) must be provided'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        const db = getDb();
        const { satellites } = getSchema();

        // Check if satellite exists
        const existingSatellite = await db
          .select({
            id: satellites.id,
            name: satellites.name,
            satellite_type: satellites.satellite_type,
            status: satellites.status,
            capabilities: satellites.capabilities,
            satellite_url: satellites.satellite_url,
            region: satellites.region
          })
          .from(satellites)
          .where(eq(satellites.id, satelliteId))
          .limit(1);

        if (existingSatellite.length === 0) {
          request.log.warn({
            operation: 'update_satellite',
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
        const previousData = {
          name: satellite.name,
          status: satellite.status,
          capabilities: satellite.capabilities ? JSON.parse(satellite.capabilities) : [],
          satellite_url: satellite.satellite_url,
          region: satellite.region
        };

        // Build update object
        const updatePayload: {
          name?: string;
          status?: 'active' | 'inactive' | 'maintenance' | 'error';
          capabilities?: string;
          satellite_url?: string;
          region?: string | null;
          updated_at: Date;
        } = {
          updated_at: new Date()
        };

        if (updateData.name) {
          updatePayload.name = updateData.name.trim();
        }

        if (updateData.status) {
          updatePayload.status = updateData.status;
        }

        if (updateData.capabilities) {
          updatePayload.capabilities = JSON.stringify(updateData.capabilities);
        }

        if (updateData.satellite_url) {
          updatePayload.satellite_url = updateData.satellite_url.trim();
        }

        if (updateData.region !== undefined) {
          updatePayload.region = updateData.region ? updateData.region.trim() : null;
        }

        // Update satellite
        const updateResult = await db
          .update(satellites)
          .set(updatePayload)
          .where(eq(satellites.id, satelliteId))
          .returning({
            id: satellites.id,
            name: satellites.name,
            satellite_type: satellites.satellite_type,
            status: satellites.status,
            capabilities: satellites.capabilities,
            satellite_url: satellites.satellite_url,
            region: satellites.region,
            updated_at: satellites.updated_at
          });

        if (updateResult.length === 0) {
          request.log.error({
            operation: 'update_satellite',
            userId: request.user?.id,
            satelliteId
          }, 'Failed to update satellite');

          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Failed to update satellite'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(500).type('application/json').send(jsonString);
        }

        const updatedSatellite = updateResult[0];

        request.log.info({
          operation: 'update_satellite',
          userId: request.user?.id,
          satelliteId,
          satelliteName: updatedSatellite.name,
          updatedFields: Object.keys(updateData)
        }, `Successfully updated satellite ${updatedSatellite.name}`);

        // Emit SATELLITE_UPDATED event
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
            EVENT_NAMES.SATELLITE_UPDATED,
            {
              satellite: {
                id: updatedSatellite.id,
                name: updatedSatellite.name,
                satellite_type: updatedSatellite.satellite_type
              },
              updatedBy: {
                id: request.user!.id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                email: (request.user as any).email
              },
              changes: {
                ...(updateData.name && {
                  name: {
                    from: previousData.name,
                    to: updateData.name
                  }
                }),
                ...(updateData.status && {
                  status: {
                    from: previousData.status,
                    to: updateData.status
                  }
                }),
                ...(updateData.capabilities && {
                  capabilities: {
                    from: previousData.capabilities,
                    to: updateData.capabilities
                  }
                }),
                ...(updateData.satellite_url && {
                  satellite_url: {
                    from: previousData.satellite_url,
                    to: updateData.satellite_url
                  }
                }),
                ...(updateData.region !== undefined && {
                  region: {
                    from: previousData.region,
                    to: updateData.region
                  }
                })
              },
              metadata: {
                ip: request.ip
              }
            },
            eventContext
          );
          request.log.info(`SATELLITE_UPDATED event emitted for satellite: ${updatedSatellite.id}`);
        } catch (eventError) {
          request.log.error(eventError, `Failed to emit SATELLITE_UPDATED event for satellite ${updatedSatellite.id}`);
          // Don't fail update if event emission fails
        }

        const response: UpdateSatelliteSuccessResponse = {
          success: true,
          data: {
            id: updatedSatellite.id,
            name: updatedSatellite.name,
            satellite_type: updatedSatellite.satellite_type,
            status: updatedSatellite.status,
            capabilities: updatedSatellite.capabilities ? JSON.parse(updatedSatellite.capabilities) : [],
            satellite_url: updatedSatellite.satellite_url,
            region: updatedSatellite.region,
            updated_at: updatedSatellite.updated_at.toISOString()
          }
        };

        const jsonString = JSON.stringify(response);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        request.log.error({
          operation: 'update_satellite',
          userId: request.user?.id,
          satelliteId: request.params?.satelliteId,
          error
        }, `Error updating satellite: ${error instanceof Error ? error.message : 'Unknown error'}`);

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to update satellite',
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
