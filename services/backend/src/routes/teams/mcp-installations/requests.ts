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

const REQUESTS_QUERY_SCHEMA = {
	type: 'object',
	properties: {
		limit: {
			type: 'integer',
			minimum: 1,
			maximum: 100,
			default: 50,
			description: 'Number of request logs to return (max 100)',
		},
		offset: {
			type: 'integer',
			minimum: 0,
			default: 0,
			description: 'Pagination offset',
		},
		success: {
			type: 'boolean',
			description: 'Filter by success status (true = successful requests, false = failed requests)',
		},
	},
	additionalProperties: false,
} as const;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

const USER_OBJECT_SCHEMA = {
	type: 'object',
	properties: {
		user_id: { type: 'string', description: 'User ID' },
		user_name: { type: 'string', description: 'Username' },
		email: { type: 'string', description: 'User email address' },
	},
	required: ['user_id', 'user_name', 'email'],
} as const;

const REQUEST_ENTRY_SCHEMA = {
	type: 'object',
	properties: {
		id: { type: 'string', description: 'Request log entry unique identifier' },
		user: {
			oneOf: [USER_OBJECT_SCHEMA, { type: 'null' }],
			description: 'User who made the request (nullable)',
		},
		tool_name: { type: 'string', description: 'Name of the tool that was called' },
		tool_params: {
			description: 'Parameters passed to the tool (JSONB)',
		},
		tool_response: {
			description: 'The actual response from MCP server (JSONB, nullable)',
		},
		response_time_ms: { type: 'integer', description: 'Response time in milliseconds' },
		success: { type: 'boolean', description: 'Whether the call succeeded' },
		error_message: { type: ['string', 'null'], description: 'Error message if failed (nullable)' },
		created_at: {
			type: 'string',
			format: 'date-time',
			description: 'ISO 8601 timestamp when request was made',
		},
	},
	required: ['id', 'tool_name', 'response_time_ms', 'success', 'created_at'],
} as const;

const REQUESTS_DATA_SCHEMA = {
	type: 'object',
	properties: {
		requests: {
			type: 'array',
			items: REQUEST_ENTRY_SCHEMA,
			description: 'Array of request log entries',
		},
		total: { type: 'integer', description: 'Total number of requests matching criteria' },
		limit: { type: 'integer', description: 'Number of requests returned per page' },
		offset: { type: 'integer', description: 'Current pagination offset' },
	},
	required: ['requests', 'total', 'limit', 'offset'],
} as const;

const REQUESTS_SUCCESS_RESPONSE_SCHEMA = {
	type: 'object',
	properties: {
		success: { type: 'boolean', description: 'Indicates if the operation was successful' },
		data: REQUESTS_DATA_SCHEMA,
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

interface RequestsQueryParams {
	limit?: number;
	offset?: number;
	success?: boolean;
}

interface UserObject {
	user_id: string;
	user_name: string;
	email: string;
}

interface RequestEntry {
	id: string;
	user: UserObject | null;
	tool_name: string;
	tool_params: unknown;
	tool_response: unknown;
	response_time_ms: number;
	success: boolean;
	error_message: string | null;
	created_at: string;
}

interface RequestsData {
	requests: RequestEntry[];
	total: number;
	limit: number;
	offset: number;
}

interface RequestsSuccessResponse {
	success: boolean;
	data: RequestsData;
}

interface ErrorResponse {
	success: boolean;
	error: string;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getInstallationRequestsRoute(server: FastifyInstance) {
	server.get<{
		Params: TeamAndInstallationParams;
		Querystring: RequestsQueryParams;
	}>('/teams/:teamId/mcp/installations/:installationId/requests', {
		preValidation: requireTeamPermission('mcp.installations.view'),
		schema: {
			tags: ['MCP Installations'],
			summary: 'Get installation request logs',
			description:
				'Retrieves request logs (tool calls with params and responses) for a specific MCP installation. Includes tool_name, tool_params, tool_response, timing, and success status. Requires mcp.installations.view permission. Note: Request logging can be disabled per-installation via settings. Logs are returned newest first.',
			security: [{ cookieAuth: [] }, { bearerAuth: [] }],

			params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
			querystring: REQUESTS_QUERY_SCHEMA,

			response: {
				200: {
					...REQUESTS_SUCCESS_RESPONSE_SCHEMA,
					description: 'Installation request logs retrieved successfully',
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
		const { limit = 50, offset = 0, success: successFilter } = request.query as RequestsQueryParams;
		const userId = request.user!.id;

		request.log.info(
			{
				operation: 'get_installation_requests',
				teamId,
				installationId,
				userId,
				limit,
				offset,
				successFilter,
			},
			'Retrieving request logs for installation'
		);

		try {
			const db = getDb();
			const { mcpServerInstallations, mcpRequestLogs, authUser } = getSchema();

			// Step 1: Verify installation exists and belongs to the specified team
			const installation = await db
				.select({ id: mcpServerInstallations.id })
				.from(mcpServerInstallations)
				.where(and(eq(mcpServerInstallations.id, installationId), eq(mcpServerInstallations.team_id, teamId)))
				.limit(1);

			if (!installation || installation.length === 0) {
				request.log.warn(
					{
						operation: 'get_installation_requests',
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
			const conditions = [
				eq(mcpRequestLogs.installation_id, installationId),
				eq(mcpRequestLogs.team_id, teamId)
			];

			// Add success filter if provided
			if (successFilter !== undefined) {
				conditions.push(eq(mcpRequestLogs.success, successFilter));
			}

			// Step 3: Query request logs with pagination (LEFT JOIN with authUser)
			const requests = await db
				.select({
					// Request log fields
					id: mcpRequestLogs.id,
					user_id: mcpRequestLogs.user_id,
					tool_name: mcpRequestLogs.tool_name,
					tool_params: mcpRequestLogs.tool_params,
					tool_response: mcpRequestLogs.tool_response,
					response_time_ms: mcpRequestLogs.response_time_ms,
					success: mcpRequestLogs.success,
					error_message: mcpRequestLogs.error_message,
					created_at: mcpRequestLogs.created_at,
					// User fields (nullable)
					user_name: authUser.username,
					user_email: authUser.email,
				})
				.from(mcpRequestLogs)
				.leftJoin(authUser, eq(mcpRequestLogs.user_id, authUser.id))
				.where(and(...conditions))
				.orderBy(desc(mcpRequestLogs.created_at))
				.limit(limit)
				.offset(offset);

			// Step 4: Get total count for pagination
			const totalResult = await db
				.select({ count: count() })
				.from(mcpRequestLogs)
				.where(and(...conditions));

			const totalCount = totalResult[0]?.count || 0;

			// Step 5: Format response
			const formattedRequests: RequestEntry[] = requests.map((req) => ({
				id: req.id,
				user: req.user_id && req.user_name && req.user_email
					? {
							user_id: req.user_id,
							user_name: req.user_name,
							email: req.user_email,
					  }
					: null,
				tool_name: req.tool_name,
				tool_params: req.tool_params,
				tool_response: req.tool_response,
				response_time_ms: req.response_time_ms,
				success: req.success,
				error_message: req.error_message,
				created_at: req.created_at.toISOString(),
			}));

			const successResponse: RequestsSuccessResponse = {
				success: true,
				data: {
					requests: formattedRequests,
					total: totalCount,
					limit,
					offset,
				},
			};

			request.log.info(
				{
					operation: 'get_installation_requests_success',
					teamId,
					installationId,
					requestCount: formattedRequests.length,
					total: totalCount,
				},
				'Installation request logs retrieved successfully'
			);

			const jsonString = JSON.stringify(successResponse);
			return reply.status(200).type('application/json').send(jsonString);

		} catch (error) {
			request.log.error(
				{
					operation: 'get_installation_requests_failed',
					teamId,
					installationId,
					error: error instanceof Error ? error.message : 'Unknown error',
				},
				'Failed to retrieve installation request logs'
			);

			const errorResponse: ErrorResponse = {
				success: false,
				error: 'Failed to retrieve installation request logs',
			};
			const jsonString = JSON.stringify(errorResponse);
			return reply.status(500).type('application/json').send(jsonString);
		}
	});
}
