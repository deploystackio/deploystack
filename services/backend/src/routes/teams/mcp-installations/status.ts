import { type FastifyInstance } from 'fastify';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, and } from 'drizzle-orm';

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

const STATUS_DATA_SCHEMA = {
	type: 'object',
	properties: {
		installation_id: { type: 'string', description: 'Installation unique identifier' },
		status: {
			type: 'string',
			enum: [
				'provisioning',
				'command_received',
				'connecting',
				'discovering_tools',
				'syncing_tools',
				'online',
				'offline',
				'error',
				'requires_reauth',
				'permanently_failed',
			],
			description: 'Current status of the MCP server installation',
		},
		status_message: {
			type: ['string', 'null'],
			description: 'Human-readable status message or error details',
		},
		status_updated_at: {
			type: 'string',
			format: 'date-time',
			description: 'ISO 8601 timestamp when status was last updated',
		},
		last_health_check_at: {
			type: ['string', 'null'],
			format: 'date-time',
			description: 'ISO 8601 timestamp when health was last checked',
		},
	},
	required: ['installation_id', 'status', 'status_updated_at'],
} as const;

const STATUS_SUCCESS_RESPONSE_SCHEMA = {
	type: 'object',
	properties: {
		success: { type: 'boolean', description: 'Indicates if the operation was successful' },
		data: STATUS_DATA_SCHEMA,
	},
	required: ['success', 'data'],
} as const;

const ERROR_RESPONSE_SCHEMA = {
	type: 'object',
	properties: {
		success: { type: 'boolean', default: false, description: 'Indicates failure' },
		error: { type: 'string', description: 'Error message detailing what went wrong' },
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

interface StatusData {
	installation_id: string;
	status: string;
	status_message: string | null;
	status_updated_at: string;
	last_health_check_at: string | null;
}

interface StatusSuccessResponse {
	success: boolean;
	data: StatusData;
}

interface ErrorResponse {
	success: boolean;
	error: string;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getInstallationStatusRoute(server: FastifyInstance) {
	server.get<{
		Params: TeamAndInstallationParams;
	}>('/teams/:teamId/mcp/installations/:installationId/status', {
		preValidation: requireTeamPermission('mcp.installations.view'),
		schema: {
			tags: ['MCP Installations'],
			summary: 'Get installation status',
			description:
				'Retrieves the current status of a specific MCP installation including status message and timestamps. Requires mcp.installations.view permission.',
			security: [{ cookieAuth: [] }, { bearerAuth: [] }],

			// Fastify validation schema
			params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,

			response: {
				200: {
					...STATUS_SUCCESS_RESPONSE_SCHEMA,
					description: 'Installation status retrieved successfully',
				},
				401: {
					...ERROR_RESPONSE_SCHEMA,
					description: 'Unauthorized - Authentication required',
				},
				403: {
					...ERROR_RESPONSE_SCHEMA,
					description: 'Forbidden - Insufficient permissions or not a team member',
				},
				404: {
					...ERROR_RESPONSE_SCHEMA,
					description: 'Not Found - Installation does not exist or does not belong to specified team',
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

		request.log.info(
			{
				operation: 'get_installation_status',
				teamId,
				installationId,
				userId,
			},
			'Retrieving status for installation'
		);

		try {
			const db = getDb();
			const { mcpServerInstances, mcpServerInstallations } = getSchema();

			// Verify installation exists and belongs to team
			const installation = await db
				.select({ id: mcpServerInstallations.id })
				.from(mcpServerInstallations)
				.where(and(eq(mcpServerInstallations.id, installationId), eq(mcpServerInstallations.team_id, teamId)))
				.limit(1);

			if (!installation || installation.length === 0) {
				request.log.warn(
					{
						operation: 'get_installation_status',
						teamId,
						installationId,
						userId,
					},
					'Installation not found or does not belong to team'
				);

				const errorResponse: ErrorResponse = {
					success: false,
					error: 'Installation not found or does not belong to specified team',
				};
				const jsonString = JSON.stringify(errorResponse);
				return reply.status(404).type('application/json').send(jsonString);
			}

			// Query the authenticated user's instance status
			const instance = await db
				.select({
					id: mcpServerInstances.id,
					status: mcpServerInstances.status,
					status_message: mcpServerInstances.status_message,
					status_updated_at: mcpServerInstances.status_updated_at,
					last_health_check_at: mcpServerInstances.last_health_check_at,
				})
				.from(mcpServerInstances)
				.where(
					and(
						eq(mcpServerInstances.installation_id, installationId),
						eq(mcpServerInstances.user_id, userId)
					)
				)
				.limit(1);

			if (!instance || instance.length === 0) {
				request.log.warn(
					{
						operation: 'get_installation_status',
						teamId,
						installationId,
						userId,
					},
					'Instance not found for this user'
				);

				const errorResponse: ErrorResponse = {
					success: false,
					error: 'Instance not found for this user',
				};
				const jsonString = JSON.stringify(errorResponse);
				return reply.status(404).type('application/json').send(jsonString);
			}

			const instanceData = instance[0];

			request.log.info(
				{
					operation: 'get_installation_status',
					teamId,
					installationId,
					userId,
					status: instanceData.status,
				},
				'Retrieved status for user instance'
			);

			const successResponse: StatusSuccessResponse = {
				success: true,
				data: {
					installation_id: installationId,
					status: instanceData.status,
					status_message: instanceData.status_message,
					status_updated_at: instanceData.status_updated_at?.toISOString() || new Date().toISOString(),
					last_health_check_at: instanceData.last_health_check_at?.toISOString() || null,
				},
			};
			const jsonString = JSON.stringify(successResponse);
			return reply.status(200).type('application/json').send(jsonString);
		} catch (error) {
			request.log.error(
				{
					operation: 'get_installation_status',
					error,
					teamId,
					installationId,
					userId,
				},
				'Failed to retrieve installation status'
			);

			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

			const errorResponse: ErrorResponse = {
				success: false,
				error: errorMessage,
			};
			const jsonString = JSON.stringify(errorResponse);
			return reply.status(500).type('application/json').send(jsonString);
		}
	});
}
