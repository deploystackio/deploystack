import { type FastifyInstance } from 'fastify';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, and } from 'drizzle-orm';

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

const PARAMS_SCHEMA = {
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
		requestId: {
			type: 'string',
			minLength: 1,
			description: 'Request log entry ID',
		},
	},
	required: ['teamId', 'installationId', 'requestId'],
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

const SINGLE_REQUEST_SCHEMA = {
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
	required: ['id', 'tool_name', 'tool_response', 'response_time_ms', 'success', 'created_at'],
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
	type: 'object',
	properties: {
		success: { type: 'boolean', description: 'Indicates if the operation was successful' },
		data: SINGLE_REQUEST_SCHEMA,
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

interface RequestParams {
	teamId: string;
	installationId: string;
	requestId: string;
}

interface UserObject {
	user_id: string;
	user_name: string;
	email: string;
}

interface SingleRequestData {
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

interface SuccessResponse {
	success: boolean;
	data: SingleRequestData;
}

interface ErrorResponse {
	success: boolean;
	error: string;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getRequestByIdRoute(server: FastifyInstance) {
	server.get<{
		Params: RequestParams;
	}>('/teams/:teamId/mcp/installations/:installationId/requests/:requestId', {
		preValidation: requireTeamPermission('mcp.installations.view'),
		schema: {
			tags: ['MCP Installations'],
			summary: 'Get single request by ID with full response',
			description:
				'Retrieves a single request log entry including the full tool_response. Use this endpoint to fetch complete request details on-demand after viewing the request in the list. Requires mcp.installations.view permission.',
			security: [{ cookieAuth: [] }, { bearerAuth: [] }],

			params: PARAMS_SCHEMA,

			response: {
				200: {
					...SUCCESS_RESPONSE_SCHEMA,
					description: 'Request details retrieved successfully',
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
					description: 'Not Found - Request does not exist or does not belong to specified installation',
				},
				500: {
					...ERROR_RESPONSE_SCHEMA,
					description: 'Internal Server Error',
				},
			},
		},
	}, async (request, reply) => {
		const { teamId, installationId, requestId } = request.params as RequestParams;
		const userId = request.user!.id;

		request.log.info(
			{
				operation: 'get_request_by_id',
				teamId,
				installationId,
				requestId,
				userId,
			},
			'Retrieving single request log entry'
		);

		try {
			const db = getDb();
			const { mcpRequestLogs, authUser } = getSchema();

			// Query with LEFT JOIN to authUser (same pattern as list endpoints)
			const result = await db
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
				.where(and(
					eq(mcpRequestLogs.id, requestId),
					eq(mcpRequestLogs.installation_id, installationId),
					eq(mcpRequestLogs.team_id, teamId)
				))
				.limit(1);

			// Return 404 if not found or doesn't belong to team/installation
			if (!result || result.length === 0) {
				request.log.warn(
					{
						operation: 'get_request_by_id',
						teamId,
						installationId,
						requestId,
						userId,
					},
					'Request not found or does not belong to specified installation'
				);

				const errorResponse: ErrorResponse = {
					success: false,
					error: 'Request not found or does not belong to specified installation',
				};
				const jsonString = JSON.stringify(errorResponse);
				return reply.status(404).type('application/json').send(jsonString);
			}

			const req = result[0];
			const requestData: SingleRequestData = {
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
			};

			const successResponse: SuccessResponse = {
				success: true,
				data: requestData,
			};

			request.log.info(
				{
					operation: 'get_request_by_id_success',
					teamId,
					installationId,
					requestId,
				},
				'Request log entry retrieved successfully'
			);

			const jsonString = JSON.stringify(successResponse);
			return reply.status(200).type('application/json').send(jsonString);

		} catch (error) {
			request.log.error(
				{
					operation: 'get_request_by_id_failed',
					teamId,
					installationId,
					requestId,
					error: error instanceof Error ? error.message : 'Unknown error',
				},
				'Failed to retrieve request log entry'
			);

			const errorResponse: ErrorResponse = {
				success: false,
				error: 'Failed to retrieve request log entry',
			};
			const jsonString = JSON.stringify(errorResponse);
			return reply.status(500).type('application/json').send(jsonString);
		}
	});
}
