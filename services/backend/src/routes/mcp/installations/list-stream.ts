import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { getDb } from '../../../db';
import {
  TEAM_ID_PARAM_SCHEMA,
  DUAL_AUTH_SECURITY,
  formatInstallationListResponse,
  type TeamIdParams,
  type RawInstallationListItem
} from './schemas';

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getInstallationsStreamRoute(server: FastifyInstance) {
  server.get<{
    Params: TeamIdParams;
  }>('/teams/:teamId/mcp/installations/stream', {
    sse: true,
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:read'),
      requireTeamPermission('mcp.installations.view')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Stream MCP installations (SSE)',
      description: 'Real-time installations list stream via Server-Sent Events. Sends initial snapshot then streams list changes as they occur (new installations, deletions, status updates). Connection automatically reconnects on disconnect.',
      security: DUAL_AUTH_SECURITY,

      params: TEAM_ID_PARAM_SCHEMA,
    },
  }, async (request, reply) => {
    const { teamId } = request.params as TeamIdParams;
    const userId = request.user!.id;
    const authType = request.tokenPayload ? 'oauth2' : 'cookie';

    request.log.info(
      {
        operation: 'stream_mcp_installations',
        teamId,
        userId,
        authType
      },
      'Starting MCP installations SSE stream'
    );

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);

      // Step 1: Get initial installations list
      const initialInstallations = await installationService.getTeamInstallations(teamId, userId);

      // Step 2: Send initial snapshot
      const initialSnapshot = formatInstallationListResponse(initialInstallations as RawInstallationListItem[]);

      reply.sse.send({
        id: new Date().toISOString(),
        event: 'snapshot',
        data: { installations: initialSnapshot },
      });

      request.log.info(
        {
          operation: 'stream_snapshot_sent',
          teamId,
          installationsCount: initialInstallations.length,
        },
        'Initial installations snapshot sent'
      );

      // Step 3: Keep connection alive
      reply.sse.keepAlive();

      // Track last update for change detection
      let lastInstallationIds = new Set(initialInstallations.map(i => i.id));

      // Step 4: Poll for changes every 3 seconds
      const pollInterval = setInterval(async () => {
        // Check #1: Before starting async work
        if (!reply.sse.isConnected) {
          clearInterval(pollInterval);
          return;
        }

        try {
          // Query for updated installations
          const updatedInstallations = await installationService.getTeamInstallations(teamId, userId);
          const currentInstallationIds = new Set(updatedInstallations.map(i => i.id));

          // Check #2: After async operation completes
          if (!reply.sse.isConnected) {
            clearInterval(pollInterval);
            return;
          }

          // Detect changes:
          // 1. New installations (ID in current but not in last)
          // 2. Deleted installations (ID in last but not in current)
          // 3. Status changes or other updates
          const hasNewInstallations = Array.from(currentInstallationIds).some(id => !lastInstallationIds.has(id));
          const hasDeletedInstallations = Array.from(lastInstallationIds).some(id => !currentInstallationIds.has(id));

          // Check for status changes by comparing installation objects
          const hasStatusChanges = updatedInstallations.some(updated => {
            const previous = initialInstallations.find(prev => prev.id === updated.id);
            if (!previous) return false; // New installation, already covered

            // Compare status fields (using type assertion since these are raw database results)
            const prevRaw = previous as unknown as RawInstallationListItem;
            const updatedRaw = updated as unknown as RawInstallationListItem;

            return (
              prevRaw.status !== updatedRaw.status ||
              prevRaw.status_message !== updatedRaw.status_message ||
              prevRaw.last_used_at?.getTime() !== updatedRaw.last_used_at?.getTime()
            );
          });

          if (hasNewInstallations || hasDeletedInstallations || hasStatusChanges) {
            const updatedSnapshot = formatInstallationListResponse(updatedInstallations as RawInstallationListItem[]);

            reply.sse.send({
              id: new Date().toISOString(),
              event: 'installations_update',
              data: { installations: updatedSnapshot },
            });

            // Update tracking variables
            lastInstallationIds = currentInstallationIds;
            initialInstallations.length = 0;
            initialInstallations.push(...updatedInstallations);

            request.log.debug(
              {
                operation: 'stream_installations_update',
                teamId,
                installationsCount: updatedInstallations.length,
                hasNewInstallations,
                hasDeletedInstallations,
                hasStatusChanges
              },
              'Installations list update streamed'
            );
          }
        } catch (error) {
          request.log.error(
            {
              operation: 'poll_installations_failed',
              teamId,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            'Failed to poll for installations updates'
          );
        }
      }, 3000); // Poll every 3 seconds

      // Step 5: Cleanup on disconnect
      reply.sse.onClose(() => {
        clearInterval(pollInterval);
        request.log.info(
          {
            operation: 'stream_mcp_installations_closed',
            teamId,
          },
          'MCP installations SSE stream closed'
        );
      });

    } catch (error) {
      request.log.error(
        {
          operation: 'stream_mcp_installations_failed',
          teamId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to start MCP installations SSE stream'
      );

      // Can't send JSON error after SSE started, log only
      throw error;
    }
  });
}
