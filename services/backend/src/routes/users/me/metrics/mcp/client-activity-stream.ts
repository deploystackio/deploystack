import { type FastifyInstance } from 'fastify';
import { requirePermission } from '../../../../../middleware/roleMiddleware';
import { getDb } from '../../../../../db';
import { McpClientActivityMetricsService } from '../../../../../services/metrics/McpClientActivityMetricsService';

const QUERY_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    team_id: {
      type: 'string',
      minLength: 1,
      description: 'Team ID to filter metrics'
    },
    time_range: {
      type: 'string',
      enum: ['1h', '3h', '6h', '12h', '24h', '3d'],
      description: 'Time range for metrics (maximum 3 days for MCP client activity)'
    },
    interval: {
      type: 'string',
      enum: ['15m'],
      description: 'Bucket interval for aggregation (only 15m supported for MCP client activity)'
    },
    satellite_id: {
      type: 'string',
      description: 'Optional satellite ID to filter metrics'
    },
    auth_identifier: {
      type: 'string',
      description: 'Optional auth identifier to filter metrics'
    }
  },
  required: ['team_id'],
  additionalProperties: false
} as const;

interface QueryParams {
  team_id: string;
  time_range?: string;
  interval?: string;
  satellite_id?: string;
  auth_identifier?: string;
}

export default async function mcpClientActivityMetricsStreamRoute(server: FastifyInstance) {
  server.get('/client-activity/stream', {
    sse: true,
    preValidation: requirePermission('metrics.mcp_client_activity_metrics.view'),
    schema: {
      tags: ['Users', 'Metrics', 'MCP'],
      summary: 'Stream MCP client activity metrics via SSE',
      description: 'Real-time stream of MCP client activity metrics using Server-Sent Events. Pushes updates every 15 seconds.',
      security: [{ cookieAuth: [] }],
      querystring: QUERY_PARAMS_SCHEMA
    }
  }, async (request, reply) => {
    const userId = request.user!.id;
    const query = request.query as QueryParams;
    const teamId = query.team_id;
    const timeRange = query.time_range || '3h';
    const interval = query.interval || '15m';

    let updateInterval: NodeJS.Timeout | null = null;
    let lastDataHash = '';

    const db = getDb();
    const metricsService = new McpClientActivityMetricsService(db, server.log);

    // Keep connection open
    reply.sse.keepAlive();

    // Send initial data
    try {
      const result = await metricsService.getMetrics(
        userId,
        teamId,
        timeRange,
        interval,
        query.satellite_id,
        query.auth_identifier
      );

      lastDataHash = JSON.stringify(result.data);

      reply.sse.send({
        event: 'mcp_metrics',
        data: { metrics: result.data }
      });
    } catch (error) {
      server.log.error(error, 'SSE: Error fetching initial MCP metrics');
      reply.sse.send({
        event: 'error',
        data: { error: 'Failed to fetch MCP metrics' }
      });
    }

    // Set up periodic updates (every 15 seconds)
    updateInterval = setInterval(async () => {
      if (!reply.sse.isConnected) {
        if (updateInterval) clearInterval(updateInterval);
        return;
      }

      try {
        const result = await metricsService.getMetrics(
          userId,
          teamId,
          timeRange,
          interval,
          query.satellite_id,
          query.auth_identifier
        );

        const currentHash = JSON.stringify(result.data);

        // Only send if data changed
        if (currentHash !== lastDataHash) {
          lastDataHash = currentHash;
          reply.sse.send({
            event: 'mcp_metrics',
            data: { metrics: result.data }
          });
        }
      } catch (error) {
        server.log.error(error, 'SSE: Error fetching MCP metrics update');
      }
    }, 15000);

    // Cleanup on disconnect
    reply.sse.onClose(() => {
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
      server.log.debug({ userId, teamId }, 'SSE: MCP metrics stream closed');
    });
  });
}
