import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb, getSchema } from '../../../db';
import { requirePermission } from '../../../middleware/roleMiddleware';

interface UpdateStatusParams {
  Params: {
    satelliteId: string;
  };
  Body: {
    status: 'active' | 'inactive' | 'maintenance' | 'error';
  };
}

export default async function updateSatelliteStatusRoute(server: FastifyInstance) {
  server.patch<UpdateStatusParams>(
    '/satellites/manage/:satelliteId/status',
    {
      preHandler: [requirePermission('satellites.manage')],
      schema: {
        tags: ['Satellite Management'],
        summary: 'Update satellite status',
        description: 'Update the status of a specific satellite. Requires global_admin role.',
        params: {
          type: 'object',
          properties: {
            satelliteId: {
              type: 'string',
              description: 'Unique satellite identifier'
            }
          },
          required: ['satelliteId']
        },
        body: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'maintenance', 'error'],
              description: 'New satellite status'
            }
          },
          required: ['status']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  satellite: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      satellite_type: { type: 'string', enum: ['global', 'team'] },
                      status: { type: 'string', enum: ['active', 'inactive', 'maintenance', 'error'] },
                      updated_at: { type: 'string' }
                    }
                  }
                }
              },
              message: { type: 'string' }
            }
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' }
            }
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' }
            }
          },
          403: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' }
            }
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<UpdateStatusParams>, reply: FastifyReply) => {
      try {
        const { satelliteId } = request.params;
        const { status } = request.body;

        request.log.info({
          operation: 'update_satellite_status',
          userId: request.user?.id,
          satelliteId,
          newStatus: status
        }, `Updating satellite ${satelliteId} status to ${status}`);

        // Validate status enum (additional validation beyond schema)
        const validStatuses = ['active', 'inactive', 'maintenance', 'error'] as const;
        if (!validStatuses.includes(status)) {
          const errorResponse = {
            success: false,
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
          };
          return reply.status(400).send(errorResponse);
        }

        const db = getDb();
        const { satellites } = getSchema();

        // Check if satellite exists
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
            operation: 'update_satellite_status',
            userId: request.user?.id,
            satelliteId
          }, `Satellite not found: ${satelliteId}`);

          const errorResponse = {
            success: false,
            error: 'Satellite not found'
          };
          return reply.status(404).send(errorResponse);
        }

        const satellite = existingSatellite[0];
        const oldStatus = satellite.status;

        // Update satellite status
        const updateResult = await db
          .update(satellites)
          .set({ 
            status,
            updated_at: new Date()
          })
          .where(eq(satellites.id, satelliteId))
          .returning({
            id: satellites.id,
            name: satellites.name,
            satellite_type: satellites.satellite_type,
            status: satellites.status,
            updated_at: satellites.updated_at
          });

        if (updateResult.length === 0) {
          request.log.error({
            operation: 'update_satellite_status',
            userId: request.user?.id,
            satelliteId
          }, `Failed to update satellite status`);

          const errorResponse = {
            success: false,
            error: 'Failed to update satellite status'
          };
          return reply.status(500).send(errorResponse);
        }

        const updatedSatellite = updateResult[0];

        request.log.info({
          operation: 'update_satellite_status',
          userId: request.user?.id,
          satelliteId,
          satelliteName: updatedSatellite.name,
          oldStatus,
          newStatus: status,
          updatedAt: updatedSatellite.updated_at
        }, `Successfully updated satellite ${updatedSatellite.name} status from ${oldStatus} to ${status}`);

        const response = {
          success: true,
          data: {
            satellite: {
              id: updatedSatellite.id,
              name: updatedSatellite.name,
              satellite_type: updatedSatellite.satellite_type,
              status: updatedSatellite.status,
              updated_at: updatedSatellite.updated_at.toISOString()
            }
          },
          message: `Satellite status updated from ${oldStatus} to ${status}`
        };

        return reply.status(200).send(response);

      } catch (error) {
        request.log.error({
          operation: 'update_satellite_status',
          userId: request.user?.id,
          satelliteId: request.params?.satelliteId,
          error
        }, `Error updating satellite status: ${error instanceof Error ? error.message : 'Unknown error'}`);

        const errorResponse = {
          success: false,
          error: 'Failed to update satellite status',
          details: error instanceof Error ? error.message : 'Unknown error'
        };

        return reply.status(500).send(errorResponse);
      }
    }
  );
}
