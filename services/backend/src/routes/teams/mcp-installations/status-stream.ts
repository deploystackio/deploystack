import { type FastifyInstance } from 'fastify';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, and, gt } from 'drizzle-orm';

// =============================================================================
// PARAMETER SCHEMAS (shared with REST endpoint)
// =============================================================================

const TEAM_AND_INSTALLATION_PARAMS_SCHEMA = {
	type: 'object',
	properties: {
		teamId: {
			type: 'string',
			minLength: 1,
			description: 'Team ID that owns the installation',
		},
		installationId: {
			type: 'string',
			minLength: 1,
			description: 'Installation ID',
		},
	},
	required: ['teamId', 'installationId'],
	additionalProperties: false,
} as const;

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

interface TeamAndInstallationParams {
	teamId: string;
	installationId: string;
}

interface StatusData {
	installation_id: string;
	status: string;
	status_message: string | null;
	status_updated_at: string;
	last_health_check_at: string | null;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getInstallationStatusStreamRoute(server: FastifyInstance) {
	server.get<{
		Params: TeamAndInstallationParams;
	}>('/teams/:teamId/mcp/installations/:installationId/status/stream', {
		sse: true,
		preValidation: requireTeamPermission('mcp.installations.view'),
		schema: {
			tags: ['MCP Installations'],
			summary: 'Stream installation status (SSE)',
			description:
				'Real-time installation status stream via Server-Sent Events. Sends initial snapshot then streams status changes as they occur. Connection automatically reconnects on disconnect.',
			security: [{ cookieAuth: [] }, { bearerAuth: [] }],

			params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
		},
	}, async (request, reply) => {
		const { teamId, installationId } = request.params as TeamAndInstallationParams;
		const userId = request.user!.id;

		request.log.info(
			{
				operation: 'stream_installation_status',
				teamId,
				installationId,
				userId,
			},
			'Starting installation status SSE stream'
		);

		try {
			const db = getDb();
			const { mcpServerInstallations } = getSchema();

			// Step 1: Verify installation exists and belongs to team
			const installation = await db
				.select({
					id: mcpServerInstallations.id,
					status: mcpServerInstallations.status,
					status_message: mcpServerInstallations.status_message,
					status_updated_at: mcpServerInstallations.status_updated_at,
					last_health_check_at: mcpServerInstallations.last_health_check_at,
				})
				.from(mcpServerInstallations)
				.where(and(eq(mcpServerInstallations.id, installationId), eq(mcpServerInstallations.team_id, teamId)))
				.limit(1);

			if (!installation || installation.length === 0) {
				request.log.warn(
					{
						operation: 'stream_installation_status',
						teamId,
						installationId,
						userId,
					},
					'Installation not found or does not belong to team'
				);

				return reply.status(404).send({
					success: false,
					error: 'Installation not found or does not belong to specified team',
				});
			}

			const currentStatus = installation[0];

			// Step 2: Send initial snapshot
			const initialSnapshot: StatusData = {
				installation_id: currentStatus.id,
				status: currentStatus.status,
				status_message: currentStatus.status_message,
				status_updated_at: currentStatus.status_updated_at.toISOString(),
				last_health_check_at: currentStatus.last_health_check_at?.toISOString() || null,
			};

			reply.sse.send({
				id: currentStatus.status_updated_at.toISOString(),
				event: 'snapshot',
				data: initialSnapshot,
			});

			request.log.info(
				{
					operation: 'stream_snapshot_sent',
					teamId,
					installationId,
					currentStatus: currentStatus.status,
				},
				'Initial status snapshot sent'
			);

			// Step 3: Keep connection alive
			reply.sse.keepAlive();

			// Track last sent timestamp for polling
			let lastUpdatedAt = currentStatus.status_updated_at;

			// Step 4: Poll for status updates every 2 seconds
			const pollInterval = setInterval(async () => {
				// Check #1: Before starting async work
				if (!reply.sse.isConnected) {
					clearInterval(pollInterval);
					return;
				}

				try {
					// Query for updated status
					const updated = await db
						.select({
							id: mcpServerInstallations.id,
							status: mcpServerInstallations.status,
							status_message: mcpServerInstallations.status_message,
							status_updated_at: mcpServerInstallations.status_updated_at,
							last_health_check_at: mcpServerInstallations.last_health_check_at,
						})
						.from(mcpServerInstallations)
						.where(
							and(
								eq(mcpServerInstallations.id, installationId),
								eq(mcpServerInstallations.team_id, teamId),
								gt(mcpServerInstallations.status_updated_at, lastUpdatedAt)
							)
						)
						.limit(1);

					// Check #2: After async operation completes
					if (!reply.sse.isConnected) {
						clearInterval(pollInterval);
						return;
					}

					if (updated.length > 0) {
						const newStatus = updated[0];

						const statusUpdate: StatusData = {
							installation_id: newStatus.id,
							status: newStatus.status,
							status_message: newStatus.status_message,
							status_updated_at: newStatus.status_updated_at.toISOString(),
							last_health_check_at: newStatus.last_health_check_at?.toISOString() || null,
						};

						reply.sse.send({
							id: newStatus.status_updated_at.toISOString(),
							event: 'status_update',
							data: statusUpdate,
						});

						lastUpdatedAt = newStatus.status_updated_at;

						request.log.debug(
							{
								operation: 'stream_status_update',
								teamId,
								installationId,
								newStatus: newStatus.status,
							},
							'Status update streamed'
						);
					}
				} catch (error) {
					request.log.error(
						{
							operation: 'poll_status_failed',
							teamId,
							installationId,
							error: error instanceof Error ? error.message : 'Unknown error',
						},
						'Failed to poll for status updates'
					);
				}
			}, 2000); // Poll every 2 seconds

			// Step 5: Cleanup on disconnect
			reply.sse.onClose(() => {
				clearInterval(pollInterval);
				request.log.info(
					{
						operation: 'stream_installation_status_closed',
						teamId,
						installationId,
					},
					'Installation status SSE stream closed'
				);
			});

		} catch (error) {
			request.log.error(
				{
					operation: 'stream_installation_status_failed',
					teamId,
					installationId,
					error: error instanceof Error ? error.message : 'Unknown error',
				},
				'Failed to start installation status SSE stream'
			);

			// Can't send JSON error after SSE started, log only
			throw error;
		}
	});
}
