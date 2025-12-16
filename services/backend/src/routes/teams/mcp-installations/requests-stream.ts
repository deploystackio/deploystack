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

const REQUESTS_QUERY_SCHEMA = {
	type: 'object',
	properties: {
		success: {
			type: 'boolean',
			description: 'Filter by success status (true = successful requests, false = failed requests)',
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

interface RequestsQueryParams {
	success?: boolean;
	limit?: number;
}

interface RequestEntry {
	id: string;
	user_id: string | null;
	tool_name: string;
	tool_params: unknown;
	tool_response: unknown;
	response_time_ms: number;
	success: boolean;
	error_message: string | null;
	created_at: string;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getInstallationRequestsStreamRoute(server: FastifyInstance) {
	server.get<{
		Params: TeamAndInstallationParams;
		Querystring: RequestsQueryParams;
	}>('/teams/:teamId/mcp/installations/:installationId/requests/stream', {
		sse: true,
		preValidation: requireTeamPermission('mcp.installations.view'),
		schema: {
			tags: ['MCP Installations'],
			summary: 'Stream installation request logs (SSE)',
			description:
				'Real-time request logs stream via Server-Sent Events. Sends initial snapshot then streams new requests as they arrive. Includes tool_name, tool_params, tool_response, timing, and success status. Supports same filtering as REST endpoint. Connection automatically reconnects on disconnect.',
			security: [{ cookieAuth: [] }, { bearerAuth: [] }],

			params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
			querystring: REQUESTS_QUERY_SCHEMA,
		},
	}, async (request, reply) => {
		const { teamId, installationId } = request.params as TeamAndInstallationParams;
		const { success: successFilter, limit = 50 } = request.query as RequestsQueryParams;
		const userId = request.user!.id;

		request.log.info(
			{
				operation: 'stream_installation_requests',
				teamId,
				installationId,
				userId,
				successFilter,
			},
			'Starting request logs SSE stream'
		);

		try {
			const db = getDb();
			const { mcpServerInstallations, mcpRequestLogs } = getSchema();

			// Step 1: Verify installation exists and belongs to team
			const installation = await db
				.select({ id: mcpServerInstallations.id })
				.from(mcpServerInstallations)
				.where(and(eq(mcpServerInstallations.id, installationId), eq(mcpServerInstallations.team_id, teamId)))
				.limit(1);

			if (!installation || installation.length === 0) {
				request.log.warn(
					{
						operation: 'stream_installation_requests',
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
				eq(mcpRequestLogs.installation_id, installationId),
				eq(mcpRequestLogs.team_id, teamId)
			];

			if (successFilter !== undefined) {
				conditions.push(eq(mcpRequestLogs.success, successFilter));
			}

			// Step 3: Send initial snapshot
			const initialRequests = await db
				.select()
				.from(mcpRequestLogs)
				.where(and(...conditions))
				.orderBy(desc(mcpRequestLogs.created_at))
				.limit(limit);

			const formattedInitialRequests: RequestEntry[] = initialRequests.map((req) => ({
				id: req.id,
				user_id: req.user_id,
				tool_name: req.tool_name,
				tool_params: req.tool_params,
				tool_response: req.tool_response,
				response_time_ms: req.response_time_ms,
				success: req.success,
				error_message: req.error_message,
				created_at: req.created_at.toISOString(),
			}));

			reply.sse.send({
				id: initialRequests[0]?.id || '0',
				event: 'snapshot',
				data: {
					requests: formattedInitialRequests,
				},
			});

			request.log.info(
				{
					operation: 'stream_snapshot_sent',
					teamId,
					installationId,
					requestCount: formattedInitialRequests.length,
				},
				'Initial snapshot sent'
			);

			// Step 4: Keep connection alive
			reply.sse.keepAlive();

			// Track last sent timestamp for polling
			let lastSentTimestamp = initialRequests[0]?.created_at || new Date(0);

			// Step 5: Poll for new requests every 3 seconds
			const pollInterval = setInterval(async () => {
				if (!reply.sse.isConnected) {
					clearInterval(pollInterval);
					return;
				}

				try {
					const newRequests = await db
						.select()
						.from(mcpRequestLogs)
						.where(and(
							...conditions,
							gt(mcpRequestLogs.created_at, lastSentTimestamp)
						))
						.orderBy(desc(mcpRequestLogs.created_at))
						.limit(100);

					// Check connection still open after async query
					if (!reply.sse.isConnected) {
						clearInterval(pollInterval);
						return;
					}

					if (newRequests.length > 0) {
						for (const req of newRequests.reverse()) { // Reverse to send oldest first
							// Check connection before each send in loop
							if (!reply.sse.isConnected) {
								clearInterval(pollInterval);
								return;
							}

							const formattedRequest: RequestEntry = {
								id: req.id,
								user_id: req.user_id,
								tool_name: req.tool_name,
								tool_params: req.tool_params,
								tool_response: req.tool_response,
								response_time_ms: req.response_time_ms,
								success: req.success,
								error_message: req.error_message,
								created_at: req.created_at.toISOString(),
							};

							reply.sse.send({
								id: req.id,
								event: 'request',
								data: formattedRequest,
							});
						}

						lastSentTimestamp = newRequests[0].created_at;

						request.log.debug(
							{
								operation: 'stream_new_requests',
								teamId,
								installationId,
								newRequestCount: newRequests.length,
							},
							'New requests streamed'
						);
					}
				} catch (error) {
					request.log.error(
						{
							operation: 'poll_requests_failed',
							teamId,
							installationId,
							error: error instanceof Error ? error.message : 'Unknown error',
						},
						'Failed to poll for new requests'
					);
				}
			}, 3000); // Poll every 3 seconds

			// Step 6: Cleanup on disconnect
			reply.sse.onClose(() => {
				clearInterval(pollInterval);
				request.log.info(
					{
						operation: 'stream_installation_requests_closed',
						teamId,
						installationId,
					},
					'Request logs SSE stream closed'
				);
			});

		} catch (error) {
			request.log.error(
				{
					operation: 'stream_installation_requests_failed',
					teamId,
					installationId,
					error: error instanceof Error ? error.message : 'Unknown error',
				},
				'Failed to start request logs SSE stream'
			);

			// Can't send JSON error after SSE started, log only
			throw error;
		}
	});
}
