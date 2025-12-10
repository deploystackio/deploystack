import { type FastifyInstance } from 'fastify';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, and, desc, count } from 'drizzle-orm';

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

const LOGS_QUERY_SCHEMA = {
	type: 'object',
	properties: {
		limit: {
			type: 'integer',
			minimum: 1,
			maximum: 100,
			default: 50,
			description: 'Number of logs to return (max 100)',
		},
		offset: {
			type: 'integer',
			minimum: 0,
			default: 0,
			description: 'Pagination offset',
		},
		level: {
			type: 'string',
			enum: ['info', 'warn', 'error', 'debug'],
			description: 'Filter by log level',
		},
	},
	additionalProperties: false,
} as const;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

const LOG_ENTRY_SCHEMA = {
	type: 'object',
	properties: {
		id: { type: 'string', description: 'Log entry unique identifier' },
		level: {
			type: 'string',
			enum: ['info', 'warn', 'error', 'debug'],
			description: 'Log level',
		},
		message: { type: 'string', description: 'Log message content' },
		metadata: {
			type: ['object', 'null'],
			description: 'Structured metadata (nullable)',
		},
		created_at: {
			type: 'string',
			format: 'date-time',
			description: 'ISO 8601 timestamp when log was created',
		},
	},
	required: ['id', 'level', 'message', 'created_at'],
} as const;

const LOGS_DATA_SCHEMA = {
	type: 'object',
	properties: {
		logs: {
			type: 'array',
			items: LOG_ENTRY_SCHEMA,
			description: 'Array of log entries',
		},
		total: { type: 'integer', description: 'Total number of logs matching criteria' },
		limit: { type: 'integer', description: 'Number of logs returned per page' },
		offset: { type: 'integer', description: 'Current pagination offset' },
	},
	required: ['logs', 'total', 'limit', 'offset'],
} as const;

const LOGS_SUCCESS_RESPONSE_SCHEMA = {
	type: 'object',
	properties: {
		success: { type: 'boolean', description: 'Indicates if the operation was successful' },
		data: LOGS_DATA_SCHEMA,
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

interface LogsQueryParams {
	limit?: number;
	offset?: number;
	level?: 'info' | 'warn' | 'error' | 'debug';
}

interface LogEntry {
	id: string;
	level: string;
	message: string;
	metadata: unknown | null;
	created_at: string;
}

interface LogsData {
	logs: LogEntry[];
	total: number;
	limit: number;
	offset: number;
}

interface LogsSuccessResponse {
	success: boolean;
	data: LogsData;
}

interface ErrorResponse {
	success: boolean;
	error: string;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getInstallationLogsRoute(server: FastifyInstance) {
	server.get<{
		Params: TeamAndInstallationParams;
		Querystring: LogsQueryParams;
	}>('/teams/:teamId/mcp/installations/:installationId/logs', {
		preValidation: requireTeamPermission('mcp.installations.view'),
		schema: {
			tags: ['MCP Installations'],
			summary: 'Get installation logs',
			description:
				'Retrieves logs for a specific MCP installation with pagination and optional level filtering. Requires mcp.installations.view permission. Logs are returned newest first.',
			security: [{ cookieAuth: [] }, { bearerAuth: [] }],

			// Fastify validation schemas
			params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
			querystring: LOGS_QUERY_SCHEMA,

			response: {
				200: {
					...LOGS_SUCCESS_RESPONSE_SCHEMA,
					description: 'Installation logs retrieved successfully',
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
		const { limit = 50, offset = 0, level } = request.query as LogsQueryParams;
		const userId = request.user!.id;

		request.log.info(
			{
				operation: 'get_installation_logs',
				teamId,
				installationId,
				userId,
				limit,
				offset,
				level,
			},
			'Retrieving logs for installation'
		);

		try {
			const db = getDb();
			const { mcpServerInstallations, mcpServerLogs } = getSchema();

			// Step 1: Verify installation exists and belongs to the specified team
			const installation = await db
				.select({ id: mcpServerInstallations.id })
				.from(mcpServerInstallations)
				.where(and(eq(mcpServerInstallations.id, installationId), eq(mcpServerInstallations.team_id, teamId)))
				.limit(1);

			if (!installation || installation.length === 0) {
				request.log.warn(
					{
						operation: 'get_installation_logs',
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

			// Step 2: Build query conditions
			const conditions = [eq(mcpServerLogs.installation_id, installationId), eq(mcpServerLogs.team_id, teamId)];

			// Add level filter if provided
			if (level) {
				conditions.push(eq(mcpServerLogs.log_level, level));
			}

			// Step 3: Get total count for pagination
			const totalResult = await db.select({ count: count() }).from(mcpServerLogs).where(and(...conditions));

			const total = totalResult[0]?.count || 0;

			// Step 4: Query logs with pagination (newest first)
			const logs = await db
				.select({
					id: mcpServerLogs.id,
					log_level: mcpServerLogs.log_level,
					message: mcpServerLogs.message,
					metadata: mcpServerLogs.metadata,
					created_at: mcpServerLogs.created_at,
				})
				.from(mcpServerLogs)
				.where(and(...conditions))
				.orderBy(desc(mcpServerLogs.created_at))
				.limit(limit)
				.offset(offset);

			// Step 5: Format logs response
			const formattedLogs: LogEntry[] = logs.map((log) => ({
				id: log.id,
				level: log.log_level,
				message: log.message,
				metadata: log.metadata,
				created_at: log.created_at.toISOString(),
			}));

			request.log.info(
				{
					operation: 'get_installation_logs',
					teamId,
					installationId,
					userId,
					logsReturned: formattedLogs.length,
					total,
				},
				'Retrieved logs for installation'
			);

			const successResponse: LogsSuccessResponse = {
				success: true,
				data: {
					logs: formattedLogs,
					total,
					limit,
					offset,
				},
			};
			const jsonString = JSON.stringify(successResponse);
			return reply.status(200).type('application/json').send(jsonString);
		} catch (error) {
			request.log.error(
				{
					operation: 'get_installation_logs',
					error,
					teamId,
					installationId,
					userId,
				},
				'Failed to retrieve installation logs'
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
