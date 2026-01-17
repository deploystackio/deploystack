import { type FastifyInstance } from 'fastify';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { McpInstanceService } from '../../../services/mcpInstanceService';
import { TeamService } from '../../../services/teamService';
import { formatInstancesResponse } from '../../mcp/installations/schemas';
import type { InstanceData } from '../../mcp/installations/schemas';

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

const INSTANCE_SCHEMA = {
	type: 'object',
	properties: {
		id: { type: 'string', description: 'Unique instance ID' },
		user_id: { type: 'string', description: 'User ID who owns this instance' },
		user_slug: { type: 'string', description: 'User slug (username) for display' },
		user_email: { type: 'string', format: 'email', description: 'User email address' },
		status: { type: 'string', description: 'Current instance status' },
		status_message: { type: 'string', nullable: true, description: 'Optional status message' },
		status_updated_at: { type: 'string', format: 'date-time', description: 'When status was last updated' },
		last_health_check_at: { type: 'string', format: 'date-time', nullable: true, description: 'Last health check timestamp' },
		created_at: { type: 'string', format: 'date-time', description: 'Instance creation timestamp' },
		updated_at: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
	},
	required: ['id', 'user_id', 'user_slug', 'user_email', 'status', 'status_updated_at'],
} as const;

const INSTANCES_LIST_SUCCESS_RESPONSE_SCHEMA = {
	type: 'object',
	properties: {
		success: { type: 'boolean', description: 'Indicates if the operation was successful' },
		data: {
			type: 'array',
			items: INSTANCE_SCHEMA,
			description: 'Array of instances. team_admin sees all instances; team_user sees only their own.',
		},
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

interface InstancesListSuccessResponse {
	success: boolean;
	data: InstanceData[];
}

interface ErrorResponse {
	success: boolean;
	error: string;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getInstallationInstancesRoute(server: FastifyInstance) {
	server.get<{
		Params: TeamAndInstallationParams;
	}>('/teams/:teamId/mcp/installations/:installationId/instances', {
		preValidation: requireTeamPermission('mcp.installations.instances.view'),
		schema: {
			tags: ['MCP Installations'],
			summary: 'Get instances for an installation',
			description:
				'Retrieves per-user instances for a specific MCP installation. team_admin sees all instances with user details (username, email). team_user sees only their own instance. Requires mcp.installations.instances.view permission.',
			security: [{ cookieAuth: [] }, { bearerAuth: [] }],

			params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,

			response: {
				200: {
					...INSTANCES_LIST_SUCCESS_RESPONSE_SCHEMA,
					description: 'Instances retrieved successfully',
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
				operation: 'get_installation_instances',
				teamId,
				installationId,
				userId,
			},
			'Retrieving instances for installation'
		);

		try {
			const db = getDb();
			const instanceService = new McpInstanceService(db, request.log);

			// Check if user is team_admin
			const isTeamAdmin = await TeamService.isTeamAdmin(teamId, userId);

			request.log.debug(
				{
					operation: 'get_installation_instances',
					teamId,
					userId,
					isTeamAdmin,
				},
				'User role determined for instance filtering'
			);

			// Fetch all instances for this installation
			const allInstances = await instanceService.getInstancesWithUsersByInstallation(
				installationId,
				teamId
			);

			// If no instances found, the installation either doesn't exist or doesn't belong to the team
			if (!allInstances || allInstances.length === 0) {
				request.log.warn(
					{
						operation: 'get_installation_instances',
						teamId,
						installationId,
						userId,
					},
					'No instances found for installation'
				);

				const errorResponse: ErrorResponse = {
					success: false,
					error: 'Installation not found or does not belong to specified team',
				};
				const jsonString = JSON.stringify(errorResponse);
				return reply.status(404).type('application/json').send(jsonString);
			}

			// Filter instances based on user role
			let filteredInstances = allInstances;
			if (!isTeamAdmin) {
				// team_user: Only show their own instance
				filteredInstances = allInstances.filter(instance => instance.user_id === userId);

				request.log.debug(
					{
						operation: 'get_installation_instances',
						teamId,
						userId,
						totalInstances: allInstances.length,
						filteredInstances: filteredInstances.length,
					},
					'Filtered instances for team_user'
				);
			} else {
				request.log.debug(
					{
						operation: 'get_installation_instances',
						teamId,
						userId,
						totalInstances: allInstances.length,
					},
					'Returning all instances for team_admin'
				);
			}

			// Format response
			const formattedInstances = formatInstancesResponse(filteredInstances);

			const successResponse: InstancesListSuccessResponse = {
				success: true,
				data: formattedInstances as any, // eslint-disable-line @typescript-eslint/no-explicit-any
			};
			const jsonString = JSON.stringify(successResponse);
			return reply.status(200).type('application/json').send(jsonString);
		} catch (error) {
			request.log.error(
				{
					error,
					teamId,
					installationId,
					userId,
				},
				'Failed to retrieve installation instances'
			);

			const errorResponse: ErrorResponse = {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			};
			const jsonString = JSON.stringify(errorResponse);
			return reply.status(500).type('application/json').send(jsonString);
		}
	});
}
