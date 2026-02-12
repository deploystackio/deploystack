import { type FastifyInstance } from 'fastify';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, and } from 'drizzle-orm';
import { McpHealthCheckService } from '../../../services/mcpHealthCheckService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';

// =============================================================================
// PARAMETER SCHEMAS
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
// RESPONSE SCHEMAS
// =============================================================================

const RECONNECT_SUCCESS_RESPONSE_SCHEMA = {
	type: 'object',
	properties: {
		success: { type: 'boolean' },
		data: {
			type: 'object',
			properties: {
				status: { type: 'string', enum: ['recovering', 'still_offline'] },
				message: { type: 'string' },
				health_check: {
					type: 'object',
					properties: {
						error: { type: 'string' },
						responseTimeMs: { type: 'number' },
					},
				},
			},
			required: ['status', 'message'],
		},
	},
	required: ['success', 'data'],
} as const;

const ERROR_RESPONSE_SCHEMA = {
	type: 'object',
	properties: {
		success: { type: 'boolean', default: false },
		error: { type: 'string' },
	},
	required: ['success', 'error'],
} as const;

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

interface TeamAndInstallationParams {
	teamId: string;
	installationId: string;
}

interface ErrorResponse {
	success: boolean;
	error: string;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function reconnectInstallationRoute(server: FastifyInstance) {
	server.post<{
		Params: TeamAndInstallationParams;
	}>('/teams/:teamId/mcp/installations/:installationId/reconnect', {
		preValidation: requireTeamPermission('mcp.installations.view'),
		schema: {
			tags: ['MCP Installations'],
			summary: 'Reconnect offline HTTP/SSE MCP server',
			description:
				'Triggers an immediate health check for a remote HTTP/SSE MCP server and initiates recovery if the server is reachable again. Only works for HTTP/SSE servers with offline or error status.',
			security: [{ cookieAuth: [] }, { bearerAuth: [] }],
			params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
			response: {
				200: {
					...RECONNECT_SUCCESS_RESPONSE_SCHEMA,
					description: 'Reconnection result',
				},
				400: {
					...ERROR_RESPONSE_SCHEMA,
					description: 'Bad Request - Server is not HTTP/SSE or instance is not in reconnectable state',
				},
				401: {
					...ERROR_RESPONSE_SCHEMA,
					description: 'Unauthorized - Authentication required',
				},
				403: {
					...ERROR_RESPONSE_SCHEMA,
					description: 'Forbidden - Insufficient permissions',
				},
				404: {
					...ERROR_RESPONSE_SCHEMA,
					description: 'Not Found - Installation or instance not found',
				},
				500: {
					...ERROR_RESPONSE_SCHEMA,
					description: 'Internal Server Error',
				},
			},
		},
	}, async (request, reply) => {
		const { teamId, installationId } = request.params as TeamAndInstallationParams;
		const userId = request.user!.id;

		request.log.info({
			operation: 'reconnect_installation',
			teamId,
			installationId,
			userId,
		}, 'Reconnect requested for installation');

		try {
			const db = getDb();
			const { mcpServerInstallations, mcpServerInstances, mcpServers } = getSchema();

			// Verify installation exists and belongs to team
			const installationRows = await db
				.select({
					id: mcpServerInstallations.id,
					server_id: mcpServerInstallations.server_id,
				})
				.from(mcpServerInstallations)
				.where(and(
					eq(mcpServerInstallations.id, installationId),
					eq(mcpServerInstallations.team_id, teamId)
				))
				.limit(1);

			if (installationRows.length === 0) {
				const errorResponse: ErrorResponse = {
					success: false,
					error: 'Installation not found or does not belong to specified team',
				};
				return reply.status(404).type('application/json').send(JSON.stringify(errorResponse));
			}

			const installation = installationRows[0];

			// Get server transport type
			const serverRows = await db
				.select({
					id: mcpServers.id,
					transport_type: mcpServers.transport_type,
				})
				.from(mcpServers)
				.where(eq(mcpServers.id, installation.server_id))
				.limit(1);

			if (serverRows.length === 0) {
				const errorResponse: ErrorResponse = {
					success: false,
					error: 'MCP server template not found',
				};
				return reply.status(404).type('application/json').send(JSON.stringify(errorResponse));
			}

			const serverTemplate = serverRows[0];

			// Only HTTP/SSE servers can be reconnected
			if (serverTemplate.transport_type === 'stdio') {
				const errorResponse: ErrorResponse = {
					success: false,
					error: 'Reconnect is only available for HTTP/SSE servers',
				};
				return reply.status(400).type('application/json').send(JSON.stringify(errorResponse));
			}

			// Verify user's instance exists and is in a reconnectable state
			const instanceRows = await db
				.select({
					id: mcpServerInstances.id,
					status: mcpServerInstances.status,
				})
				.from(mcpServerInstances)
				.where(and(
					eq(mcpServerInstances.installation_id, installationId),
					eq(mcpServerInstances.user_id, userId)
				))
				.limit(1);

			if (instanceRows.length === 0) {
				const errorResponse: ErrorResponse = {
					success: false,
					error: 'Instance not found for this user',
				};
				return reply.status(404).type('application/json').send(JSON.stringify(errorResponse));
			}

			const instance = instanceRows[0];
			const reconnectableStatuses = ['offline', 'error'];

			if (!reconnectableStatuses.includes(instance.status)) {
				const errorResponse: ErrorResponse = {
					success: false,
					error: `Instance status is '${instance.status}', reconnect is only available for offline or error instances`,
				};
				return reply.status(400).type('application/json').send(JSON.stringify(errorResponse));
			}

			// Perform health check on the template
			const healthCheckService = new McpHealthCheckService(db, request.log);
			const healthResult = await healthCheckService.checkTemplateHealth(serverTemplate.id);

			if (healthResult.status === 'online') {
				// Server is back online — distribute status and trigger recovery
				const satelliteCommandService = new SatelliteCommandService(db, request.log);
				healthCheckService.setSatelliteCommandService(satelliteCommandService);

				const distribution = await healthCheckService.distributeHealthStatus(
					serverTemplate.id,
					'online'
				);

				if (distribution.recoveredInstallations.length > 0) {
					await healthCheckService.handleRecovery(distribution.recoveredInstallations);
				}

				request.log.info({
					operation: 'reconnect_installation_success',
					teamId,
					installationId,
					userId,
					recoveredCount: distribution.recoveredInstallations.length,
				}, 'Server is reachable, recovery initiated');

				const successResponse = {
					success: true,
					data: {
						status: 'recovering',
						message: 'Server is reachable and reconnection is in progress',
					},
				};
				return reply.status(200).type('application/json').send(JSON.stringify(successResponse));
			} else {
				// Server is still offline
				request.log.info({
					operation: 'reconnect_installation_still_offline',
					teamId,
					installationId,
					userId,
					healthError: healthResult.error,
				}, 'Server is still unreachable');

				const stillOfflineResponse = {
					success: true,
					data: {
						status: 'still_offline',
						message: 'The remote server is still not responding',
						health_check: {
							error: healthResult.error,
							responseTimeMs: healthResult.responseTimeMs,
						},
					},
				};
				return reply.status(200).type('application/json').send(JSON.stringify(stillOfflineResponse));
			}
		} catch (error) {
			request.log.error({
				operation: 'reconnect_installation',
				error,
				teamId,
				installationId,
				userId,
			}, 'Failed to reconnect installation');

			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			const errorResponse: ErrorResponse = {
				success: false,
				error: errorMessage,
			};
			return reply.status(500).type('application/json').send(JSON.stringify(errorResponse));
		}
	});
}
