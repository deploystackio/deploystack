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

const QUERY_SCHEMA = {
	type: 'object',
	properties: {
		user_only: {
			type: 'string',
			enum: ['true', 'false'],
			description: 'Filter to requesting user instance only'
		}
	}
} as const;

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

interface TeamAndInstallationParams {
	teamId: string;
	installationId: string;
}

interface StatusStreamQuery {
	user_only?: 'true' | 'false';
}

interface InstanceStatusData {
	installation_id: string;
	instance_id: string;
	user_id: string;
	user_slug: string;
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
		Querystring: StatusStreamQuery;
	}>('/teams/:teamId/mcp/installations/:installationId/status/stream', {
		sse: true,
		preValidation: requireTeamPermission('mcp.installations.view'),
		schema: {
			tags: ['MCP Installations'],
			summary: 'Stream installation status (SSE)',
			description:
				'Real-time installation status stream via Server-Sent Events. Sends initial snapshot then streams status changes as they occur. Connection automatically reconnects on disconnect. Add ?user_only=true to filter to requesting user\'s instance only.',
			security: [{ cookieAuth: [] }, { bearerAuth: [] }],

			params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
			querystring: QUERY_SCHEMA,
		},
	}, async (request, reply) => {
		const { teamId, installationId } = request.params as TeamAndInstallationParams;
		const userId = request.user!.id;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _userOnly = (request.query as StatusStreamQuery).user_only === 'true';

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
			const { mcpServerInstallations, mcpServerInstances, authUser } = getSchema();

			// Step 1: Verify installation exists and belongs to team
			const installation = await db
				.select({ id: mcpServerInstallations.id })
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

				const errorResponse = {
					success: false,
					error: 'Installation not found or does not belong to specified team',
				};
				return reply.status(404).type('application/json').send(JSON.stringify(errorResponse));
			}

			// Stream the authenticated user's instance status
			// (user_only parameter is ignored - always shows user's instance)

			// Fetch user's instance
			const instance = await db
					.select({
						id: mcpServerInstances.id,
						installation_id: mcpServerInstances.installation_id,
						user_id: mcpServerInstances.user_id,
						user_slug: authUser.username,
						status: mcpServerInstances.status,
						status_message: mcpServerInstances.status_message,
						status_updated_at: mcpServerInstances.status_updated_at,
						last_health_check_at: mcpServerInstances.last_health_check_at
					})
					.from(mcpServerInstances)
					.innerJoin(authUser, eq(mcpServerInstances.user_id, authUser.id))
					.where(
						and(
							eq(mcpServerInstances.installation_id, installationId),
							eq(mcpServerInstances.user_id, userId)
						)
					)
				.limit(1);

			if (instance.length === 0) {
				const errorResponse = {
					success: false,
					error: 'Instance not found for user'
				};
				const jsonString = JSON.stringify(errorResponse);
				return reply.status(404).type('application/json').send(jsonString);
			}

			const currentInstance = instance[0];

			// Send initial snapshot
			const initialSnapshot: InstanceStatusData = {
				installation_id: currentInstance.installation_id,
				instance_id: currentInstance.id,
				user_id: currentInstance.user_id,
				user_slug: currentInstance.user_slug,
				status: currentInstance.status,
				status_message: currentInstance.status_message,
				status_updated_at: currentInstance.status_updated_at?.toISOString() || new Date().toISOString(),
				last_health_check_at: currentInstance.last_health_check_at?.toISOString() || null
			};

			reply.sse.send({
				id: currentInstance.status_updated_at?.toISOString() || new Date().toISOString(),
				event: 'instance_snapshot',
				data: initialSnapshot
			});

			request.log.info({ teamId, installationId, userId }, 'Sent instance snapshot');

			reply.sse.keepAlive();

			let lastUpdatedAt = currentInstance.status_updated_at || new Date();

			// Poll for instance updates
			const pollInterval = setInterval(async () => {
				if (!reply.sse.isConnected) {
					clearInterval(pollInterval);
					return;
				}

				try {
					const updated = await db
						.select({
							id: mcpServerInstances.id,
							installation_id: mcpServerInstances.installation_id,
							user_id: mcpServerInstances.user_id,
							user_slug: authUser.username,
							status: mcpServerInstances.status,
							status_message: mcpServerInstances.status_message,
							status_updated_at: mcpServerInstances.status_updated_at,
							last_health_check_at: mcpServerInstances.last_health_check_at
						})
						.from(mcpServerInstances)
						.innerJoin(authUser, eq(mcpServerInstances.user_id, authUser.id))
						.where(
							and(
								eq(mcpServerInstances.installation_id, installationId),
								eq(mcpServerInstances.user_id, userId),
								gt(mcpServerInstances.status_updated_at, lastUpdatedAt)
							)
						)
						.limit(1);

					if (!reply.sse.isConnected) {
						clearInterval(pollInterval);
						return;
					}

					if (updated.length > 0) {
						const newInstance = updated[0];

						reply.sse.send({
							id: newInstance.status_updated_at?.toISOString() || new Date().toISOString(),
							event: 'instance_status_update',
							data: {
								installation_id: newInstance.installation_id,
								instance_id: newInstance.id,
								user_id: newInstance.user_id,
								user_slug: newInstance.user_slug,
								status: newInstance.status,
								status_message: newInstance.status_message,
								status_updated_at: newInstance.status_updated_at?.toISOString() || new Date().toISOString(),
								last_health_check_at: newInstance.last_health_check_at?.toISOString() || null
							}
						});

						lastUpdatedAt = newInstance.status_updated_at || new Date();
						request.log.debug({ teamId, installationId, userId }, 'Instance status update streamed');
					}
				} catch (error) {
					request.log.error({ error }, 'Instance polling failed');
				}
			}, 2000);

			reply.sse.onClose(() => {
				clearInterval(pollInterval);
				request.log.info({ installationId, userId }, 'Instance SSE stream closed');
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
