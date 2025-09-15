import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { eq, and, like, desc } from 'drizzle-orm';
import { getDb } from '../../../db';
import { satellites, teams, authUser } from '../../../db/schema.sqlite';
import { requirePermission } from '../../../middleware/roleMiddleware';

interface ListSatellitesQuery {
  status?: 'active' | 'inactive' | 'maintenance' | 'error';
  satellite_type?: 'global' | 'team';
  team_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface ListSatellitesParams {
  Querystring: ListSatellitesQuery;
}

export default async function listSatellitesRoute(server: FastifyInstance) {
  server.get<ListSatellitesParams>(
    '/satellites/manage',
    {
      preHandler: [requirePermission('satellites.view')],
      schema: {
        tags: ['Satellite Management'],
        summary: 'List all satellites',
        description: 'Get a paginated list of all satellites with filtering options. Requires global_admin role.',
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'maintenance', 'error'],
              description: 'Filter by satellite status'
            },
            satellite_type: {
              type: 'string',
              enum: ['global', 'team'],
              description: 'Filter by satellite type'
            },
            team_id: {
              type: 'string',
              description: 'Filter by team ID'
            },
            search: {
              type: 'string',
              description: 'Search by satellite name'
            },
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description: 'Page number for pagination'
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Number of items per page'
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  satellites: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        satellite_type: { type: 'string', enum: ['global', 'team'] },
                        status: { type: 'string', enum: ['active', 'inactive', 'maintenance', 'error'] },
                        capabilities: { type: 'array', items: { type: 'string' } },
                        last_heartbeat: { type: ['string', 'null'] },
                        system_info: { type: ['object', 'null'] },
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
                  pagination: {
                    type: 'object',
                    properties: {
                      page: { type: 'integer' },
                      limit: { type: 'integer' },
                      total: { type: 'integer' },
                      pages: { type: 'integer' }
                    }
                  }
                }
              }
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
          }
        }
      }
    },
    async (request: FastifyRequest<ListSatellitesParams>, reply: FastifyReply) => {
      try {
        const { 
          status, 
          satellite_type, 
          team_id, 
          search, 
          page = 1, 
          limit = 20 
        } = request.query;

        request.log.info({
          operation: 'list_satellites',
          userId: request.user?.id,
          filters: { status, satellite_type, team_id, search },
          pagination: { page, limit }
        }, 'Listing satellites for admin');

        // Build query conditions
        const conditions = [];
        
        if (status) {
          conditions.push(eq(satellites.status, status));
        }
        
        if (satellite_type) {
          conditions.push(eq(satellites.satellite_type, satellite_type));
        }
        
        if (team_id) {
          conditions.push(eq(satellites.team_id, team_id));
        }
        
        if (search) {
          conditions.push(like(satellites.name, `%${search}%`));
        }

        // Calculate offset
        const offset = (page - 1) * limit;

        const db = getDb();

        // Get total count for pagination
        const totalQuery = db
          .select({ count: satellites.id })
          .from(satellites);
        
        if (conditions.length > 0) {
          totalQuery.where(and(...conditions));
        }
        
        const totalResult = await totalQuery;
        const total = totalResult.length;

        // Get satellites with related data
        let query = db
          .select({
            id: satellites.id,
            name: satellites.name,
            satellite_type: satellites.satellite_type,
            status: satellites.status,
            capabilities: satellites.capabilities,
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
          .orderBy(desc(satellites.created_at))
          .limit(limit)
          .offset(offset);

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        const results = await query;

        // Transform results to include nested objects
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const satellitesData = results.map((row: any) => ({
          id: row.id,
          name: row.name,
          satellite_type: row.satellite_type,
          status: row.status,
          capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
          last_heartbeat: row.last_heartbeat?.toISOString() || null,
          system_info: row.system_info ? JSON.parse(row.system_info) : null,
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
        }));

        const pages = Math.ceil(total / limit);

        request.log.info({
          operation: 'list_satellites',
          userId: request.user?.id,
          resultCount: satellitesData.length,
          total,
          page,
          pages
        }, `✅ Successfully listed ${satellitesData.length} satellites`);

        const response = {
          success: true,
          data: {
            satellites: satellitesData,
            pagination: {
              page,
              limit,
              total,
              pages
            }
          }
        };

        return reply.status(200).send(response);

      } catch (error) {
        request.log.error({
          operation: 'list_satellites',
          userId: request.user?.id,
          error
        }, `Error listing satellites: ${error instanceof Error ? error.message : 'Unknown error'}`);

        const errorResponse = {
          success: false,
          error: 'Failed to list satellites',
          details: error instanceof Error ? error.message : 'Unknown error'
        };

        return reply.status(500).send(errorResponse);
      }
    }
  );
}
