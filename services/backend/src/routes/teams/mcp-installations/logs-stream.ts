import { type FastifyInstance } from 'fastify';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, and, desc, gt } from 'drizzle-orm';

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

const LOGS_QUERY_SCHEMA = {
	type: 'object',
	properties: {
		level: {
			type: 'string',
			enum: ['info', 'warn', 'error', 'debug'],
			description: 'Filter by log level',
		},
		limit: {
			type: 'integer',
			minimum: 1,
			maximum: 100,
			default: 50,
			description: 'Initial snapshot size (max 100)',
		},
	},
	additionalProperties: false,
} as const;

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

interface TeamAndInstallationParams {
	teamId: string;
	installationId: string;
}

interface LogsQueryParams {
	level?: 'info' | 'warn' | 'error' | 'debug';
	limit?: number;
}

interface LogEntry {
	id: string;
	level: string;
	message: string;
	metadata: unknown;
	created_at: string;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getInstallationLogsStreamRoute(server: FastifyInstance) {
	server.get<{
		Params: TeamAndInstallationParams;
		Querystring: LogsQueryParams;
	}>('/teams/:teamId/mcp/installations/:installationId/logs/stream', {
		sse: true,
		preValidation: requireTeamPermission('mcp.installations.view'),
		schema: {
			tags: ['MCP Installations'],
			summary: 'Stream installation server logs (SSE)',
			description:
				'Real-time server logs stream via Server-Sent Events. Sends initial snapshot then streams new logs as they arrive. Supports same filtering as REST endpoint. Connection automatically reconnects on disconnect.',
			security: [{ cookieAuth: [] }, { bearerAuth: [] }],

			params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
			querystring: LOGS_QUERY_SCHEMA,
		},
	}, async (request, reply) => {
		const { teamId, installationId } = request.params as TeamAndInstallationParams;
		const { level: levelFilter, limit = 50 } = request.query as LogsQueryParams;
		const userId = request.user!.id;

		request.log.info(
			{
				operation: 'stream_installation_logs',
				teamId,
				installationId,
				userId,
				levelFilter,
			},
			'Starting server logs SSE stream'
		);

		try {
			const db = getDb();
			const { mcpServerInstallations, mcpServerLogs } = getSchema();

			// Step 1: Verify installation exists and belongs to team
			const installation = await db
				.select({ id: mcpServerInstallations.id })
				.from(mcpServerInstallations)
				.where(and(eq(mcpServerInstallations.id, installationId), eq(mcpServerInstallations.team_id, teamId)))
				.limit(1);

			if (!installation || installation.length === 0) {
				request.log.warn(
					{
						operation: 'stream_installation_logs',
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

			// Step 2: Build query conditions
			const conditions = [
				eq(mcpServerLogs.installation_id, installationId),
				eq(mcpServerLogs.team_id, teamId)
			];

			if (levelFilter) {
				conditions.push(eq(mcpServerLogs.log_level, levelFilter));
			}

			// Step 3: Send initial snapshot
			const initialLogs = await db
				.select()
				.from(mcpServerLogs)
				.where(and(...conditions))
				.orderBy(desc(mcpServerLogs.created_at))
				.limit(limit);

			const formattedInitialLogs: LogEntry[] = initialLogs.map((log) => ({
				id: log.id,
				level: log.log_level,
				message: log.message,
				metadata: log.metadata,
				created_at: log.created_at.toISOString(),
			}));

			reply.sse.send({
				id: initialLogs[0]?.id || '0',
				event: 'snapshot',
				data: {
					logs: formattedInitialLogs,
				},
			});

			request.log.info(
				{
					operation: 'stream_snapshot_sent',
					teamId,
					installationId,
					logCount: formattedInitialLogs.length,
				},
				'Initial snapshot sent'
			);

			// Step 4: Keep connection alive
			reply.sse.keepAlive();

			// Track last sent timestamp for polling
			let lastSentTimestamp = initialLogs[0]?.created_at || new Date(0);

			// Step 5: Poll for new logs every 3 seconds
			const pollInterval = setInterval(async () => {
				if (!reply.sse.isConnected) {
					clearInterval(pollInterval);
					return;
				}

				try {
					const newLogs = await db
						.select()
						.from(mcpServerLogs)
						.where(and(
							...conditions,
							gt(mcpServerLogs.created_at, lastSentTimestamp)
						))
						.orderBy(desc(mcpServerLogs.created_at))
						.limit(100);

					// Check connection still open after async query
					if (!reply.sse.isConnected) {
						clearInterval(pollInterval);
						return;
					}

					if (newLogs.length > 0) {
						for (const log of newLogs.reverse()) { // Reverse to send oldest first
							// Check connection before each send in loop
							if (!reply.sse.isConnected) {
								clearInterval(pollInterval);
								return;
							}

							const formattedLog: LogEntry = {
								id: log.id,
								level: log.log_level,
								message: log.message,
								metadata: log.metadata,
								created_at: log.created_at.toISOString(),
							};

							reply.sse.send({
								id: log.id,
								event: 'log',
								data: formattedLog,
							});
						}

						lastSentTimestamp = newLogs[0].created_at;

						request.log.debug(
							{
								operation: 'stream_new_logs',
								teamId,
								installationId,
								newLogCount: newLogs.length,
							},
							'New logs streamed'
						);
					}
				} catch (error) {
					request.log.error(
						{
							operation: 'poll_logs_failed',
							teamId,
							installationId,
							error: error instanceof Error ? error.message : 'Unknown error',
						},
						'Failed to poll for new logs'
					);
				}
			}, 3000); // Poll every 3 seconds

			// Step 6: Cleanup on disconnect
			reply.sse.onClose(() => {
				clearInterval(pollInterval);
				request.log.info(
					{
						operation: 'stream_installation_logs_closed',
						teamId,
						installationId,
					},
					'Server logs SSE stream closed'
				);
			});

		} catch (error) {
			request.log.error(
				{
					operation: 'stream_installation_logs_failed',
					teamId,
					installationId,
					error: error instanceof Error ? error.message : 'Unknown error',
				},
				'Failed to start server logs SSE stream'
			);

			// Can't send JSON error after SSE started, log only
			throw error;
		}
	});
}
